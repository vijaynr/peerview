import path from "node:path";
import {
  printAlert,
  printChatAnswer,
  printCommandHelp,
  printHorizontalLine,
  printReviewComment,
  printReviewSummary,
} from "../ui/console.js";
import { askForOptionalFeedback, promptWithFrame } from "../ui/prompt.js";
import {
  createWorkflowStatusController,
  runLiveTask,
  type LiveController,
  type WorkflowStatusController,
} from "../ui/main.js";
import { envOrConfig, loadCRConfig } from "../utils/config.js";
import { getOriginRemoteUrl } from "../utils/git.js";
import { listMergeRequests, remoteToProjectPath } from "../utils/gitlab.js";
import { repoRootFromModule } from "../utils/paths.js";
import {
  buildCreateMrResultBody,
  getFlag,
  getWorkflowHeadingAndDescription,
  getWorkflowResultTitle,
  hasFlag,
  readStdinDiff,
  type ReviewWorkflowKind,
} from "../utils/review-command.js";
import {
  maybePostReviewComment,
  runReviewWorkflow,
  type ReviewWorkflowInput,
} from "../workflows/review.js";
import { answerReviewChatQuestion, runReviewChatWorkflow } from "../workflows/review-chat.js";
import type { ReviewChatHistoryEntry, WorkflowMode } from "../types/workflows.js";
import { runCreateMrWorkflow } from "../workflows/review-create.js";
import { runReviewSummarizeWorkflow } from "../workflows/review-summarize.js";

async function askForFeedbackIteration(): Promise<string | null> {
  return askForOptionalFeedback({
    confirmMessage: "Do you want to provide feedback to improve the review comment?",
  });
}

type ReviewCommandWorkflowKind = ReviewWorkflowKind | "create";

async function resolveInteractiveRemoteSelection(input: ReviewWorkflowInput): Promise<boolean> {
  const config = await loadCRConfig();
  const gitlabUrl = envOrConfig("GITLAB_URL", config.gitlabUrl, "");
  const gitlabKey = envOrConfig("GITLAB_KEY", config.gitlabKey, "");
  if (!gitlabUrl || !gitlabKey) {
    throw new Error("Missing GitLab configuration. Run `cr init` or set GITLAB_URL/GITLAB_KEY.");
  }

  const repoUrl = input.url ?? (await getOriginRemoteUrl(input.repoPath));
  const projectPath = remoteToProjectPath(repoUrl);
  const mrs = await listMergeRequests(gitlabUrl, gitlabKey, projectPath, input.state);
  if (mrs.length === 0) {
    throw new Error("No merge requests found.");
  }
  if (mrs.length === 1) {
    input.mrIid = mrs[0].iid;
    return true;
  }

  // Use autocomplete for searchable MR selection
  const choices = mrs.map((mr) => ({
    title: `!${mr.iid} [${mr.state}] ${mr.title}`,
    value: mr.iid,
  }));

  const selection = await promptWithFrame(
    {
      type: "autocomplete",
      name: "mrIid",
      message: "Select merge request (type to search)",
      choices,
      suggest: (input: string, choices: Array<{ title: string; value?: number }>) => {
        const searchTerm = input.toLowerCase();
        return Promise.resolve(
          choices.filter((choice) => choice.title.toLowerCase().includes(searchTerm))
        );
      },
    },
    { onCancel: () => true }
  );
  if (!selection.mrIid) {
    return false;
  }
  input.mrIid = Number(selection.mrIid);
  return true;
}

async function confirmInteractiveStartIfNeeded(args: {
  workflow: ReviewWorkflowKind;
  ui: LiveController;
  workflowResultTitle: string;
}): Promise<boolean> {
  if (args.workflow === "summarize") {
    return true;
  }

  if (args.workflow === "review") {
    const confirm = await promptWithFrame(
      {
        type: "confirm",
        name: "runReview",
        message: "Do you want to run the code review for this merge request?",
        initial: false,
      },
      { onCancel: () => true }
    );
    if (!confirm.runReview) {
      args.ui.warning("Code review cancelled by user. No actions were taken.");
      args.ui.setResult(args.workflowResultTitle, "Status: Cancelled.");
      return false;
    }
    return true;
  }

  const confirm = await promptWithFrame(
    {
      type: "confirm",
      name: "startChat",
      message: "Do you want to ask questions about this merge request?",
      initial: false,
    },
    { onCancel: () => true }
  );
  if (!confirm.startChat) {
    args.ui.warning("Interactive chat cancelled by user. No actions were taken.");
    args.ui.setResult(args.workflowResultTitle, "Status: Cancelled.");
    return false;
  }
  return true;
}

async function runChatFlow(args: {
  input: ReviewWorkflowInput;
  repoRoot: string;
  workflowResultTitle: string;
  ui: LiveController;
  status: WorkflowStatusController;
}): Promise<void> {
  const { input, repoRoot, workflowResultTitle, ui, status } = args;
  const chatContext = await runReviewChatWorkflow({
    ...input,
    status: status.status,
    events: status.events,
  });

  console.log();
  ui.info(" Type 'exit' to end the chat session.");

  let history: ReviewChatHistoryEntry[] = [];
  let turns = 0;
  while (true) {
    const questionResponse = await promptWithFrame(
      {
        type: "text",
        name: "question",
        message: "",
      },
      { onCancel: () => true }
    );
    const question = String(questionResponse.question ?? "").trim();
    if (!question || question.toLowerCase() === "exit") {
      break;
    }

    const spinner = status.startSpinner("Thinking...");
    const turn = await answerReviewChatQuestion({
      repoRoot,
      context: chatContext,
      question,
      history,
    });
    status.completeSpinner(spinner, "Answer generated.");
    history = turn.history;
    turns += 1;
    printChatAnswer(turn.answer, chatContext.contextLabel);
  }

  ui.setResult(workflowResultTitle, `Context: ${chatContext.contextLabel}\nTurns: ${turns}`);
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
  if (postedInlineCount > 0) {
    args.ui.success(
      `Posted ${postedInlineCount} inline review comment(s)${
        postedSummaryNoteId ? ` + summary note ${postedSummaryNoteId}` : ""
      }.`
    );
  } else if (postedSummaryNoteId) {
    args.ui.success(`Posted review note: ${postedSummaryNoteId}`);
  }

  return { postedSummaryNoteId, postedInlineCount };
}

async function runSummaryFlow(args: {
  input: ReviewWorkflowInput;
  workflowResultTitle: string;
  ui: LiveController;
  status: WorkflowStatusController;
}): Promise<void> {
  const { input, workflowResultTitle, ui, status } = args;
  const result = await runReviewSummarizeWorkflow({
    ...input,
    status: status.status,
    events: status.events,
  });
  status.stop();
  console.log();
  printReviewSummary(result);
  ui.setResult(workflowResultTitle, `Context: ${result.contextLabel}`);
}

async function runReviewFlow(args: {
  input: ReviewWorkflowInput;
  workflowResultTitle: string;
  ui: LiveController;
  status: WorkflowStatusController;
}): Promise<void> {
  const { input, workflowResultTitle, ui, status } = args;
  const runOnce = async (userFeedback?: string) =>
    runReviewWorkflow({
      ...input,
      userFeedback,
      status: status.status,
      events: status.events,
    });
  let result = await runOnce();
  while (true) {
    status.stop();
    console.log();
    printReviewComment(result);

    if (input.mode !== "interactive") {
      break;
    }
    const nextFeedback = await askForFeedbackIteration();
    if (!nextFeedback) {
      break;
    }
    ui.info("Regenerating review with your feedback...");
    result = await runOnce(nextFeedback);
  }

  const posted = await maybePostReviewNotes({ input, result, ui });
  const postSummary =
    posted.postedInlineCount > 0 || posted.postedSummaryNoteId
      ? `\n\nPosted: ${
          posted.postedInlineCount > 0 ? `${posted.postedInlineCount} inline comment(s)` : ""
        }${
          posted.postedInlineCount > 0 && posted.postedSummaryNoteId ? " + " : ""
        }${posted.postedSummaryNoteId ? `summary note ${posted.postedSummaryNoteId}` : ""}`
      : "";
  const outputBody = `Context: ${result.contextLabel}${postSummary}`;
  ui.setResult(workflowResultTitle, outputBody);
}

async function runReviewWorkflowTask(args: {
  input: ReviewWorkflowInput;
  repoRoot: string;
  workflowResultTitle: string;
  ui: LiveController;
}): Promise<void> {
  const { input, repoRoot, workflowResultTitle, ui } = args;

  if (!input.local && input.mode === "interactive") {
    const didSelectMergeRequest = await resolveInteractiveRemoteSelection(input);
    if (!didSelectMergeRequest) {
      ui.warning("Merge request selection cancelled by user. No actions were taken.");
      ui.setResult(workflowResultTitle, "Status: Cancelled.");
      return;
    }

    const shouldContinue = await confirmInteractiveStartIfNeeded({
      workflow: input.workflow,
      ui,
      workflowResultTitle,
    });
    if (!shouldContinue) {
      return;
    }
  }

  printHorizontalLine();
  console.log();
  const status = createWorkflowStatusController({
    ui,
    workflow: "review",
  });
  try {
    if (input.workflow === "chat") {
      await runChatFlow({
        input,
        repoRoot,
        workflowResultTitle,
        ui,
        status,
      });
      return;
    }

    if (input.workflow === "summarize") {
      await runSummaryFlow({
        input,
        workflowResultTitle,
        ui,
        status,
      });
    } else {
      await runReviewFlow({
        input,
        workflowResultTitle,
        ui,
        status,
      });
    }
  } finally {
    status.close();
  }
}

function printGeneratedCreateMrDraft(draft: {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  iteration: number;
}): void {
  printReviewSummary({
    output: draft.description,
    contextLabel: `MR Draft v${draft.iteration} (${draft.sourceBranch} -> ${draft.targetBranch})`,
  });
}

async function runCreateWorkflowTask(args: {
  repoPath: string;
  targetBranch?: string;
  repoRoot: string;
  mode: WorkflowMode;
  ui: LiveController;
}): Promise<void> {
  const { repoPath, targetBranch, repoRoot, mode, ui } = args;
  printHorizontalLine();
  const live = createWorkflowStatusController({
    ui,
    workflow: "create_mr",
    lineBreakOnStop: true,
  });
  const result = await runCreateMrWorkflow({
    repoPath,
    targetBranch,
    mode,
    repoRoot,
    onDraft: (draft) => {
      live.stop();
      printGeneratedCreateMrDraft(draft);
    },
    resolveTargetBranch: async ({ defaultBranch }) => {
      const response = await promptWithFrame(
        {
          type: "text",
          name: "target",
          message: `Enter target branch (default: ${defaultBranch})`,
          initial: defaultBranch,
        },
        { onCancel: () => true }
      );
      return String(response.target ?? "").trim() || defaultBranch;
    },
    requestDraftFeedback: async () =>
      askForOptionalFeedback({
        confirmMessage: "Do you want to provide feedback to improve the merge request description?",
      }),
    confirmUpsert: async ({ existingMrIid }) => {
      const response = await promptWithFrame(
        {
          type: "confirm",
          name: "shouldProceed",
          message: existingMrIid
            ? `Update existing MR !${existingMrIid}?`
            : "Create merge request?",
          initial: true,
        },
        { onCancel: () => true }
      );
      return Boolean(response.shouldProceed);
    },
    status: live.status,
    events: live.events,
  }).finally(() => {
    live.close();
  });

  const statusText =
    result.action === "updated"
      ? "Merge Request Updated"
      : result.action === "created"
        ? "Merge Request Created"
        : "Merge Request Cancelled";
  ui.setResult("Workflow: Merge Request", buildCreateMrResultBody(result));
  if (result.action === "cancelled") {
    ui.warning(statusText);
  } else {
    ui.success(statusText);
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
          "--workflow, -w <type>       Workflow type: default, summarize, chat, create",
          "                            default: Code review for merge request",
          "                            summarize: Summary of MR changes",
          "                            chat: Interactive Q&A over MR context",
          "                            create: Create/update merge request draft",
          "",
          "--path, -p <path>           Path to repository (default: current directory)",
          "--url, -u <url>             GitLab merge request URL",
          "--mode, -m <mode>           Mode: interactive or ci (default: interactive)",
          "--local                     Review uncommitted changes via git diff",
          "--state, -s <state>         MR state filter: opened, closed, merged, all (default: opened)",
          "--target-branch, -t <name>  Target branch for create workflow",
          "--inline-comments           Post inline review comments to GitLab",
        ],
      },
      {
        title: "EXAMPLES",
        lines: [
          "cr review",
          "cr review --workflow summarize",
          "cr review --workflow chat",
          "cr review --workflow create --target-branch main",
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
          "create      Generate or update merge request description from branch changes",
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
  const targetBranch = getFlag(args, "target-branch", "", "-t") || undefined;
  const stateRaw = getFlag(args, "state", "opened", "-s");
  const local = hasFlag(args, "local");
  const inlineComments = hasFlag(args, "inline-comments");
  const repoRoot = repoRootFromModule(import.meta.url);
  const stdinDiff = await readStdinDiff();

  if (workflowRaw === "chat" && local) {
    printAlert({
      title: "Unsupported Combination",
      message: "The --local option is not supported in chat mode. Run without --local.",
      tone: "error",
    });
    process.exitCode = 1;
    return;
  }

  const workflow: ReviewCommandWorkflowKind =
    workflowRaw === "create"
      ? "create"
      : workflowRaw === "chat"
        ? "chat"
        : workflowRaw === "summarize"
          ? "summarize"
          : "review";

  if (workflow === "create") {
    try {
      await runLiveTask(
        "Merge Request",
        async (ui) =>
          runCreateWorkflowTask({
            repoPath,
            targetBranch,
            repoRoot,
            mode,
            ui,
          }),
        "Generate or update a merge request draft from branch changes."
      );
    } catch {
      process.exitCode = 1;
    }
    return;
  }

  const reviewWorkflow: ReviewWorkflowKind =
    workflowRaw === "chat" ? "chat" : workflowRaw === "summarize" ? "summarize" : "review";
  const state = ["opened", "closed", "merged", "all"].includes(stateRaw)
    ? (stateRaw as "opened" | "closed" | "merged" | "all")
    : "opened";

  const input: ReviewWorkflowInput = {
    repoPath,
    repoRoot,
    mode,
    workflow: reviewWorkflow,
    local,
    inlineComments,
    url,
    state,
    stdinDiff,
  };
  const intro = getWorkflowHeadingAndDescription(reviewWorkflow, local);
  const workflowResultTitle = getWorkflowResultTitle(reviewWorkflow, local);

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
