import path from "node:path";
import type {
  ReviewSessionEffect,
  ReviewSessionResponse,
  ReviewSessionResult,
  WorkflowMode,
} from "@pv/core";
import { envOrConfig, loadPVConfig, repoRootFromModule } from "@pv/core";
import {
  abortOnCancel,
  askForOptionalFeedback,
  createWorkflowStatusController,
  type LiveController,
  printAlert,
  printCommandHelp,
  printDivider,
  printReviewComment,
  printReviewSummary,
  promptWithFrame,
  runLiveChatLoop,
  runLiveTask,
} from "@pv/tui";
import {
  answerReviewChatQuestion,
  maybePostGitHubReviewComment,
  maybePostReviewBoardComment,
  maybePostReviewComment,
  type ReviewWorkflowInput,
  runInteractiveReviewSession,
  type runReviewWorkflow,
} from "@pv/workflows";
import {
  getFlag,
  getWorkflowHeadingAndDescription,
  getWorkflowResultTitle,
  hasFlag,
  type ReviewWorkflowKind,
  readStdinDiff,
} from "../cliHelpers.js";

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

  const config = await loadPVConfig();

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
        abortOnCancel
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

  if (args.input.provider === "github") {
    const githubToken = envOrConfig("GITHUB_TOKEN", config.githubToken, "");
    if (!githubToken) {
      return { postedInlineCount: 0 };
    }

    let shouldPost = !args.input.local;
    if (shouldPost && args.input.mode === "interactive") {
      const response = await promptWithFrame(
        {
          type: "confirm",
          name: "shouldPost",
          message: "Post this review comment to GitHub?",
          initial: false,
        },
        abortOnCancel
      );
      shouldPost = Boolean(response.shouldPost);
    }
    if (!shouldPost) {
      return { postedInlineCount: 0 };
    }

    const posted = await maybePostGitHubReviewComment(
      args.result,
      args.input.mode,
      shouldPost,
      githubToken
    );
    if (!posted) {
      return { postedInlineCount: 0 };
    }

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
      abortOnCancel
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

  const status = createWorkflowStatusController({
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
            suggest: (search: string, choices: Array<{ title: string; value?: number }>) => {
              const searchTerm = search.toLowerCase();
              return Promise.resolve(
                choices.filter((choice) => choice.title.toLowerCase().includes(searchTerm))
              );
            },
          },
          abortOnCancel
        );
        step = await session.next({
          type: "review_target_selected",
          mrIid: selection.mrIid ? Number(selection.mrIid) : null,
        });
        continue;
      }

      if (effect.type === "select_review_agents") {
        const selection = await promptWithFrame(
          {
            type: "multiselect",
            name: "agentNames",
            message: effect.message,
            choices: effect.options.map((option) => ({
              title: option.title,
              value: option.value,
              description: option.description,
              selected: option.selected,
            })),
            min: 1,
            instructions: false,
          },
          abortOnCancel
        );
        step = await session.next({
          type: "review_agents_selected",
          agentNames: Array.isArray(selection.agentNames) ? selection.agentNames : null,
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
        abortOnCancel
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
      printDivider();
      ui.setResult(workflowResultTitle, `Context: ${result.result.contextLabel}`);
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
        lines: ["pv review [options]"],
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
          "--url, -u <url>        GitLab MR URL, GitHub PR URL, or Review Board request URL",
          "--from, -f <user>      Filter Review Board requests by user",
          "--reviewboard          Use Review Board provider",
          "--github               Use GitHub provider",
          "--mode, -m <mode>      Mode: interactive or ci (default: interactive)",
          "--local                Review uncommitted changes via git diff",
          "--state, -s <state>    MR/PR state filter: opened, closed, merged, all (default: opened)",
          "--inline-comments      Post inline review comments to GitLab/GitHub",
        ],
      },
      {
        title: "EXAMPLES",
        lines: [
          "pv review",
          "pv review --workflow summarize",
          "pv review --workflow chat",
          "pv review --reviewboard",
          "pv review --reviewboard --from username",
          "pv review --path /path/to/repo",
          "pv review --url https://gitlab.com/org/repo/-/merge_requests/123",
          "pv review --reviewboard --url https://reviews.example.com/r/123/",
          "pv review --local",
          "git diff | pv review --local",
          "pv review --state all",
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

  const explicitMode = getFlag(args, "mode", "", "-m");
  const stdinIsPiped = !process.stdin.isTTY;
  const mode: WorkflowMode =
    explicitMode === "ci" || (!explicitMode && stdinIsPiped) ? "ci" : "interactive";
  const repoPath = path.resolve(getFlag(args, "path", ".", "-p"));
  const url = getFlag(args, "url", "", "-u") || undefined;
  const workflowRaw = getFlag(args, "workflow", "default", "-w");
  const stateRaw = getFlag(args, "state", "opened", "-s");
  const local = hasFlag(args, "local");
  const inlineComments = hasFlag(args, "inline-comments");
  const reviewboard = hasFlag(args, "reviewboard");
  const github = hasFlag(args, "github");
  const fromUser = getFlag(args, "from", "", "-f") || undefined;
  const repoRoot = repoRootFromModule(import.meta.url);
  const stdinDiff = await readStdinDiff();

  if (workflowRaw === "chat" && (local || reviewboard)) {
    printAlert({
      title: "Unsupported Combination",
      message: "The --local or --reviewboard option is not supported in chat mode.",
      tone: "error",
    });
    process.exitCode = 1;
    return;
  }

  // Review defaults to GitLab unless an explicit provider switch is passed.
  let provider: "gitlab" | "reviewboard" | "github";
  if (reviewboard) {
    provider = "reviewboard";
  } else if (github) {
    provider = "github";
  } else {
    provider = "gitlab";
  }

  if (reviewboard && inlineComments) {
    printAlert({
      title: "Unsupported Combination",
      message:
        "Review Board reviews currently support summary comments only. Remove --inline-comments.",
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
    provider,
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
