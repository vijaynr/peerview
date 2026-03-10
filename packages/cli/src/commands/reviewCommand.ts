import path from "node:path";
import {
  printAlert,
  printCommandHelp,
  printReviewComment,
  printReviewSummary,
} from "@cr/ui";
import { askForOptionalFeedback, promptWithFrame } from "@cr/ui";
import {
  createWorkflowStatusController,
  runLiveTask,
  runLiveChatLoop,
  type LiveController,
} from "@cr/ui";
import { envOrConfig, loadCRConfig } from "@cr/core";
import { repoRootFromModule } from "@cr/core";
import {
  getFlag,
  getWorkflowHeadingAndDescription,
  getWorkflowResultTitle,
  hasFlag,
  readStdinDiff,
  type ReviewWorkflowKind,
} from "../cliHelpers.js";
import {
  maybePostReviewComment,
  maybePostReviewBoardComment,
  runReviewWorkflow,
  runInteractiveReviewSession,
  type ReviewWorkflowInput,
} from "@cr/workflows";
import { answerReviewChatQuestion } from "@cr/workflows";
import type {
  ReviewSessionEffect,
  ReviewSessionResponse,
  ReviewSessionResult,
  WorkflowMode,
} from "@cr/core";

async function askForFeedbackIteration(): Promise<string | null> {
  return askForOptionalFeedback({
    confirmMessage: "Do you want to provide feedback to improve the review comment?",
  });
}

async function maybePostReviewNotes(args: {
  input: ReviewWorkflowInput;
  result: Awaited<ReturnType<typeof runReviewWorkflow>>;
  ui: LiveController;
}): Promise<{ postedSummaryNoteId?: string; postedInlineCount: number }> {
  if (args.input.workflow !== "review") {
    return { postedInlineCount: 0 };
  }

  const config = await loadCRConfig();

  if (args.input.provider === "reviewboard") {
    const rbToken = envOrConfig("RB_TOKEN", config.rbToken, "");
    if (!rbToken) return { postedInlineCount: 0 };

    let shouldPost = !args.input.local;
    if (shouldPost && args.input.mode === "interactive") {
      const response = await promptWithFrame(
        {
          type: "confirm",
          name: "shouldPost",
          message: "Post this review comment to Review Board?",
          initial: false,
        },
        { onCancel: () => true }
      );
      shouldPost = Boolean(response.shouldPost);
    }
    if (!shouldPost) return { postedInlineCount: 0 };

    const posted = await maybePostReviewBoardComment(
      args.result,
      args.input.mode,
      shouldPost,
      rbToken
    );
    if (!posted) return { postedInlineCount: 0 };
    return {
      postedSummaryNoteId: posted.summaryNoteId,
      postedInlineCount: posted.inlineNoteIds.length,
    };
  }

  const gitlabKey = envOrConfig("GITLAB_KEY", config.gitlabKey, "");
  if (!gitlabKey) {
    return { postedInlineCount: 0 };
  }

  let shouldPost = !args.input.local;
  if (shouldPost && args.input.mode === "interactive") {
    const response = await promptWithFrame(
      {
        type: "confirm",
        name: "shouldPost",
        message: "Post this review comment to GitLab?",
        initial: false,
      },
      { onCancel: () => true }
    );
    shouldPost = Boolean(response.shouldPost);
  }
  if (!shouldPost) {
    return { postedInlineCount: 0 };
  }

  const posted = await maybePostReviewComment(args.result, args.input.mode, shouldPost, gitlabKey);
  if (!posted) {
    return { postedInlineCount: 0 };
  }

  const postedSummaryNoteId = posted.summaryNoteId;
  const postedInlineCount = posted.inlineNoteIds.length;

  return { postedSummaryNoteId, postedInlineCount };
}

async function runReviewWorkflowTask(args: {
  input: ReviewWorkflowInput;
  repoRoot: string;
  workflowResultTitle: string;
  ui: LiveController;
}): Promise<void> {
  const { input, repoRoot, workflowResultTitle, ui } = args;

  let status = createWorkflowStatusController({
    ui,
    workflow:
      input.workflow === "chat"
        ? "reviewChat"
        : input.workflow === "summarize"
          ? "reviewSummarize"
          : "review",
  });
  try {
    const session = runInteractiveReviewSession({
      ...input,
      status: status.status,
      events: status.events,
    });

    let step = await session.next();
    while (!step.done) {
      const effect: ReviewSessionEffect = step.value;

      if (effect.type === "review_ready") {
        status.stop();
        printReviewComment(effect.result);
        step = await session.next();
        continue;
      }

      if (effect.type === "request_review_feedback") {
        const response: ReviewSessionResponse = {
          type: "review_feedback",
          feedback: await askForFeedbackIteration(),
        };
        step = await session.next(response);
        continue;
      }

      if (effect.type === "select_review_target") {
        const selection = await promptWithFrame(
          {
            type: "autocomplete",
            name: "mrIid",
            message: effect.message,
            choices: effect.options,
            suggest: (
              search: string,
              choices: Array<{ title: string; value?: number }>
            ) => {
              const searchTerm = search.toLowerCase();
              return Promise.resolve(
                choices.filter((choice) => choice.title.toLowerCase().includes(searchTerm))
              );
            },
          },
          { onCancel: () => true }
        );
        step = await session.next({
          type: "review_target_selected",
          mrIid: selection.mrIid ? Number(selection.mrIid) : null,
        });
        continue;
      }

      const confirmation = await promptWithFrame(
        {
          type: "confirm",
          name: "confirmed",
          message: effect.message,
          initial: false,
        },
        { onCancel: () => true }
      );
      step = await session.next({
        type: "review_action_confirmed",
        confirmed: Boolean(confirmation.confirmed),
      });
    }

    const result: ReviewSessionResult = step.value;
    if (result.action === "cancelled") {
      ui.setResult(workflowResultTitle, result.message);
      return;
    }

    if (result.action === "chat") {
      await runLiveChatLoop({
        chatContext: result.context,
        workflowResultTitle,
        ui,
        answerQuestion: (question, history) =>
          answerReviewChatQuestion({
            repoRoot,
            context: result.context,
            question,
            history,
            events: status.events,
          }),
      });
      return;
    }

    if (result.action === "summary") {
      status.stop();
      printReviewSummary(result.result);
      return;
    }

    const posted = await maybePostReviewNotes({ input, result: result.result, ui });
    const postSummary =
      posted.postedInlineCount > 0 || posted.postedSummaryNoteId
        ? `\n\nPosted: ${
            posted.postedInlineCount > 0 ? `${posted.postedInlineCount} inline comment(s)` : ""
          }${
            posted.postedInlineCount > 0 && posted.postedSummaryNoteId ? " + " : ""
          }${posted.postedSummaryNoteId ? `summary note ${posted.postedSummaryNoteId}` : ""}`
        : "";
    ui.setResult(workflowResultTitle, `Context: ${result.result.contextLabel}${postSummary}`);
  } finally {
    status.close();
  }
}

export async function runReviewCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printCommandHelp([
      {
        title: "USAGE",
        lines: ["cr review [options]"],
      },
      {
        title: "OPTIONS",
        lines: [
          "--workflow, -w <type>  Workflow type: default, summarize, chat",
          "                       default: Code review for merge request",
          "                       summarize: Summary of MR changes",
          "                       chat: Interactive Q&A over MR context",
          "",
          "--path, -p <path>      Path to repository (default: current directory)",
          "--url, -u <url>        GitLab merge request URL",
          "--from, -f <user>      Filter Review Board requests by user",
          "--rb                   Use Review Board provider",
          "--mode, -m <mode>      Mode: interactive or ci (default: interactive)",
          "--local                Review uncommitted changes via git diff",
          "--state, -s <state>    MR state filter: opened, closed, merged, all (default: opened)",
          "--inline-comments      Post inline review comments to GitLab/ReviewBoard",
        ],
      },
      {
        title: "EXAMPLES",
        lines: [
          "cr review",
          "cr review --workflow summarize",
          "cr review --workflow chat",
          "cr review --rb",
          "cr review --rb --from username",
          "cr review --path /path/to/repo",
          "cr review --url https://gitlab.com/org/repo/-/merge_requests/123",
          "cr review --local",
          "git diff | cr review --local",
          "cr review --state all",
        ],
      },
      {
        title: "WORKFLOWS",
        lines: [
          "default     Analyze merge request and generate detailed review comments",
          "summarize   Generate a concise summary of all changes in the MR",
          "chat        Interactive Q&A session about the merge request",
        ],
      },
    ]);
    return;
  }

  const mode: WorkflowMode =
    getFlag(args, "mode", "interactive", "-m") === "ci" ? "ci" : "interactive";
  const repoPath = path.resolve(getFlag(args, "path", ".", "-p"));
  const url = getFlag(args, "url", "", "-u") || undefined;
  const workflowRaw = getFlag(args, "workflow", "default", "-w");
  const stateRaw = getFlag(args, "state", "opened", "-s");
  const local = hasFlag(args, "local");
  const inlineComments = hasFlag(args, "inline-comments");
  const rb = hasFlag(args, "rb");
  const fromUser = getFlag(args, "from", "", "-f") || undefined;
  const repoRoot = repoRootFromModule(import.meta.url);
  const stdinDiff = await readStdinDiff();

  if (workflowRaw === "chat" && (local || rb)) {
    printAlert({
      title: "Unsupported Combination",
      message: "The --local or --rb option is not supported in chat mode.",
      tone: "error",
    });
    process.exitCode = 1;
    return;
  }

  const workflow: ReviewWorkflowKind =
    workflowRaw === "chat" ? "chat" : workflowRaw === "summarize" ? "summarize" : "review";
  const state = ["opened", "closed", "merged", "all"].includes(stateRaw)
    ? (stateRaw as "opened" | "closed" | "merged" | "all")
    : "opened";

  const input: ReviewWorkflowInput = {
    repoPath,
    repoRoot,
    mode,
    workflow,
    local,
    inlineComments,
    url,
    fromUser,
    state,
    stdinDiff,
    provider: rb ? "reviewboard" : "gitlab",
  };
  const intro = getWorkflowHeadingAndDescription(workflow, local, input.provider);
  const workflowResultTitle = getWorkflowResultTitle(workflow, local, input.provider);

  try {
    await runLiveTask(
      intro.heading,
      async (ui) =>
        runReviewWorkflowTask({
          input,
          repoRoot,
          workflowResultTitle,
          ui,
        }),
      intro.description
    );
  } catch {
    // runLiveTask already prints the error once; avoid duplicate output here.
    process.exitCode = 1;
  }
}
