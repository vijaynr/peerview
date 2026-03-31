import { EventEmitter } from "node:events";
import type {
  CreateReviewWorkflowEffect,
  CreateReviewWorkflowInput,
  CreateReviewWorkflowResponse,
  CreateReviewWorkflowResult,
  ReviewChatContext,
  ReviewChatHistoryEntry,
  StatusReporter,
  WorkflowEventReporter,
  WorkflowMode,
  WorkflowName,
} from "@pv/core";
import { printChatAnswer, printDivider, printReviewSummary, printWarning } from "./console.js";
import { COLORS, DOT } from "./constants.js";
import { abortOnCancel, askForOptionalFeedback, promptWithFrame } from "./prompt.js";

function buildCreateReviewResultBody(result: {
  sourceLabel: string;
  targetLabel?: string;
  title: string;
  url?: string;
}): string {
  const lines = [`Source: ${result.sourceLabel}`, `Title: ${result.title}`];
  if (result.targetLabel) {
    lines.splice(1, 0, `Target: ${result.targetLabel}`);
  }
  if (result.url) {
    lines.push(`URL: ${result.url}`);
  }
  return lines.join("\n");
}

function getReviewEntityLabel(entityType: "merge_request" | "review_request"): string {
  return entityType === "review_request" ? "Review Request" : "Merge Request";
}

import { createSpinner, type OraSpinner } from "./spinner.js";

type LiveLevel = "info" | "success" | "warning" | "error";

interface LiveEvent {
  level: LiveLevel;
  message: string;
}

interface LiveResult {
  title: string;
  body: string;
}

export type WorkflowStatusController = {
  status: StatusReporter;
  events: WorkflowEventReporter;
  stop: () => void;
  close: () => void;
  startSpinner: (text: string) => OraSpinner;
  completeSpinner: (spinner: OraSpinner, message: string) => void;
};

export class LiveController {
  private readonly emitter = new EventEmitter();
  private _result: LiveResult | null = null;
  private _isDone = false;

  private pushEvent(event: LiveEvent): void {
    this.emitter.emit("data", event);
  }

  info(message: string): void {
    this.pushEvent({ level: "info", message });
  }

  success(message: string): void {
    this.pushEvent({ level: "success", message });
  }

  warning(message: string): void {
    this.pushEvent({ level: "warning", message });
  }

  error(message: string): void {
    this.pushEvent({ level: "error", message });
  }

  setResult(title: string, body: string): void {
    this._result = { title, body };
  }

  get resultData(): { value: LiveResult | null } {
    return { value: this._result };
  }

  done(): void {
    if (this._isDone) return;
    this._isDone = true;
    this.emitter.emit("end");
  }

  /**
   * Returns an AsyncIterable that streams LiveEvents as they are pushed.
   * Events are buffered internally so none are lost between the call to
   * eventStream() and the first iteration step.
   */
  eventStream(): AsyncIterable<LiveEvent> {
    const { emitter } = this;
    const buffer: LiveEvent[] = [];
    let notify: (() => void) | null = null;
    let ended = this._isDone;

    const onData = (event: LiveEvent): void => {
      buffer.push(event);
      notify?.();
      notify = null;
    };

    const onEnd = (): void => {
      ended = true;
      notify?.();
      notify = null;
    };

    emitter.on("data", onData);
    emitter.once("end", onEnd);

    return {
      [Symbol.asyncIterator](): AsyncIterator<LiveEvent> {
        return {
          async next(): Promise<IteratorResult<LiveEvent>> {
            for (;;) {
              if (buffer.length > 0) {
                return { value: buffer.shift()!, done: false };
              }
              if (ended) {
                emitter.off("data", onData);
                return { value: undefined as unknown as LiveEvent, done: true };
              }
              await new Promise<void>((res) => {
                notify = res;
              });
            }
          },
          return(): Promise<IteratorResult<LiveEvent>> {
            emitter.off("data", onData);
            emitter.off("end", onEnd);
            return Promise.resolve({ value: undefined as unknown as LiveEvent, done: true });
          },
        };
      },
    };
  }
}

function persistSpinnerSuccess(spinner: OraSpinner, message: string): void {
  if (message === "") {
    spinner.stop();
    return;
  }
  spinner.stopAndPersist({
    symbol: COLORS.green + `${DOT}` + COLORS.reset,
    text: message,
  });
}

export function createWorkflowStatusController(args: {
  ui: LiveController;
  workflow: WorkflowName;
}): WorkflowStatusController {
  const { ui, workflow } = args;
  let activeSpinner: OraSpinner | null = null;

  const stop = (): void => {
    if (activeSpinner === null) {
      return;
    }
    activeSpinner.stop();
    activeSpinner = null;
  };

  const startSpinner = (text: string): OraSpinner => {
    stop();
    activeSpinner = createSpinner(text).start();
    return activeSpinner;
  };

  const completeSpinner = (spinner: OraSpinner, message: string): void => {
    persistSpinnerSuccess(spinner, message);
    if (activeSpinner === spinner) {
      activeSpinner = null;
    }
  };

  const status: StatusReporter = {
    info: (message: string) => ui.info(message),
    success: (message: string) => ui.success(message),
    warning: (message: string) => ui.warning(message),
    error: (message: string) => ui.error(message),
  };

  const events: WorkflowEventReporter = {
    emit: (event): void => {
      if (event.workflow !== workflow) {
        return;
      }
      if (event.type === "phase_started") {
        console.log(); // add spacing before new phase
        startSpinner(" " + event.message);
        return;
      }
      if (event.type === "phase_completed") {
        if (activeSpinner) {
          completeSpinner(activeSpinner, event.message);
        } else {
          if (event.workflow !== "reviewChat" && event.phase !== "answering_question") {
            status.success(event.message);
          }
        }
        return;
      }
    },
  };

  const close = (): void => {
    stop();
  };

  return {
    status,
    events,
    stop,
    close,
    startSpinner,
    completeSpinner,
  };
}

function levelToColor(level: LiveLevel): string {
  switch (level) {
    case "success":
      return COLORS.green;
    case "warning":
      return COLORS.yellow;
    case "error":
      return COLORS.red;
    default:
      return COLORS.cyan;
  }
}

function printResultWithDots(level: LiveLevel, result: LiveResult): void {
  const color = levelToColor(level);
  console.log();
  console.log(color + `${DOT} ` + result.title + COLORS.reset);
  for (const line of result.body.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    console.log(color + `${DOT} ` + line + COLORS.reset);
  }
  console.log();
}

function deriveWorkflowLabel(title: string): string {
  return title.replace(/^CR\s+/i, "").trim() || "Workflow";
}

function printTaskHeader(title: string, description?: string): void {
  const workflowLabel = deriveWorkflowLabel(title);
  console.log(COLORS.cyan + COLORS.bold + "> " + workflowLabel + COLORS.reset);
  if (description) {
    console.log(COLORS.dim + description + COLORS.reset);
  }
}

export async function runLiveTask(
  title: string,
  run: (controller: LiveController) => Promise<void>,
  description?: string
): Promise<void> {
  const controller = new LiveController();
  let runError: unknown;

  // Print header
  printTaskHeader(title, description);

  // Start consuming the event stream concurrently with the workflow run.
  // Events are buffered inside LiveController so none are dropped between
  // stream creation and the first iteration step.
  const stream$ = controller.eventStream();
  const renderDone = (async () => {
    for await (const evt of stream$) {
      const color = levelToColor(evt.level);
      console.log(color + `${DOT} ` + evt.message + COLORS.reset);
    }
  })();

  try {
    await run(controller);
  } catch (error) {
    runError = error;
  } finally {
    controller.done();
  }

  // Drain any remaining buffered events before printing the final result.
  await renderDone;

  if (runError) {
    const message = runError instanceof Error ? runError.message : String(runError);
    console.error(COLORS.red + `${DOT} Failed` + COLORS.reset);
    console.error(COLORS.red + `${DOT} ` + message + COLORS.reset);
    const resultData = controller.resultData.value;
    if (resultData) {
      printResultWithDots("error", resultData);
    }
    throw runError;
  }

  const finalResult = controller.resultData.value;
  if (finalResult !== null) {
    const isCancelled = /cancelled/i.test(finalResult.title) || /cancelled/i.test(finalResult.body);
    printResultWithDots(isCancelled ? "warning" : "success", finalResult);
  } else {
    console.log(COLORS.green + `${DOT} Completed` + COLORS.reset);
  }
}

export async function runLiveChatLoop(args: {
  chatContext: ReviewChatContext;
  workflowResultTitle: string;
  ui: LiveController;
  answerQuestion: (
    question: string,
    history: ReviewChatHistoryEntry[]
  ) => Promise<{ answer: string; history: ReviewChatHistoryEntry[] }>;
}): Promise<void> {
  const { chatContext, workflowResultTitle, ui, answerQuestion } = args;

  printDivider();
  printWarning(
    "Entering interactive chat mode. Type your question and press Enter to ask. Type 'exit' to finish."
  );

  let history: ReviewChatHistoryEntry[] = [];
  let turns = 0;

  while (true) {
    const response = await promptWithFrame(
      { type: "text", name: "question", message: "" },
      abortOnCancel
    );
    const question = String(response.question ?? "").trim();
    if (!question || question.toLowerCase() === "exit") {
      break;
    }

    const turn = await answerQuestion(question, history);
    history = turn.history;
    turns += 1;
    printChatAnswer(turn.answer, chatContext.contextLabel);
  }

  ui.setResult(workflowResultTitle, `Context: ${chatContext.contextLabel}\nTurns: ${turns}`);
}

export async function runLiveCreateReviewTask(args: {
  repoPath: string;
  targetBranch?: string;
  repoRoot: string;
  mode: WorkflowMode;
  ui: LiveController;
  status: WorkflowStatusController;
  runWorkflow: (
    input: CreateReviewWorkflowInput
  ) => AsyncGenerator<
    CreateReviewWorkflowEffect,
    CreateReviewWorkflowResult,
    CreateReviewWorkflowResponse | undefined
  >;
}): Promise<void> {
  const { repoPath, targetBranch, repoRoot, mode, ui, status, runWorkflow } = args;

  const workflow = runWorkflow({
    repoPath,
    targetBranch,
    mode,
    repoRoot,
    status: status.status,
    events: status.events,
  });

  let step = await workflow.next();
  try {
    while (!step.done) {
      const effect = step.value;

      if (effect.type === "draft_ready") {
        status.stop();
        printReviewSummary({
          output: effect.draft.description,
          contextLabel: `${getReviewEntityLabel(effect.draft.provider === "reviewboard" ? "review_request" : "merge_request")} Draft v${effect.draft.iteration} (${effect.draft.sourceLabel}${effect.draft.targetLabel ? ` -> ${effect.draft.targetLabel}` : ""})`,
        });
        step = await workflow.next();
        continue;
      }

      if (effect.type === "resolve_target_branch") {
        const response = await promptWithFrame(
          {
            type: "text",
            name: "target",
            message: `Enter target branch (default: ${effect.defaultBranch})`,
            initial: effect.defaultBranch,
          },
          abortOnCancel
        );
        step = await workflow.next({
          type: "target_branch_resolved",
          targetBranch: String(response.target ?? "").trim() || effect.defaultBranch,
        });
        continue;
      }

      if (effect.type === "request_draft_feedback") {
        const feedback = await askForOptionalFeedback({
          confirmMessage:
            effect.draft.provider === "reviewboard"
              ? "Do you want to provide feedback to improve the review request description?"
              : "Do you want to provide feedback to improve the merge request description?",
        });
        step = await workflow.next({
          type: "draft_feedback",
          feedback,
        });
        continue;
      }

      const response = await promptWithFrame(
        {
          type: "confirm",
          name: "shouldProceed",
          message: effect.existingEntityId
            ? `Update existing ${getReviewEntityLabel(effect.entityType)} #${effect.existingEntityId}?`
            : `Create ${getReviewEntityLabel(effect.entityType).toLowerCase()}?`,
          initial: true,
        },
        abortOnCancel
      );
      step = await workflow.next({
        type: "upsert_confirmed",
        shouldProceed: Boolean(response.shouldProceed),
      });
    }
  } finally {
    status.close();
  }

  const result = step.value;

  const entityLabel = getReviewEntityLabel(result.entityType);
  const statusText =
    result.action === "updated"
      ? `${entityLabel} Updated`
      : result.action === "created"
        ? `${entityLabel} Created`
        : `${entityLabel} Cancelled`;
  ui.setResult(statusText, buildCreateReviewResultBody(result));
}

export const runLiveCreateMrTask = runLiveCreateReviewTask;
