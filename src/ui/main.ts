import { printHorizontalLine } from "./console.js";
import { computed, effect, signal } from "@preact/signals-core";
import ora from "ora";
import type { StatusReporter, WorkflowEventReporter, WorkflowName } from "../types/workflows.js";
import { COLORS, DOT } from "./constants.js";

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
  startSpinner: (text: string) => ReturnType<typeof ora>;
  completeSpinner: (spinner: ReturnType<typeof ora>, message: string) => void;
};

export class LiveController {
  private readonly maxLines = 12;
  private readonly eventStream = signal<LiveEvent[]>([]);
  readonly visibleLines = computed<LiveEvent[]>(() => this.eventStream.value.slice(-this.maxLines));
  readonly resultData = signal<LiveResult | null>(null);
  private isDone = false;

  private pushEvent(event: LiveEvent): void {
    this.eventStream.value = [...this.eventStream.value, event];
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
    this.resultData.value = { title, body } satisfies LiveResult;
  }

  done(): void {
    if (this.isDone) {
      return;
    }
    this.isDone = true;
  }

  events(): readonly LiveEvent[] {
    return this.eventStream.value;
  }
}

function persistSpinnerSuccess(spinner: ReturnType<typeof ora>, message: string): void {
  spinner.stopAndPersist({
    symbol: COLORS.green + `${DOT}` + COLORS.reset,
    text: message,
  });
}

export function createWorkflowStatusController(args: {
  ui: LiveController;
  workflow: WorkflowName;
  lineBreakOnStop?: boolean;
}): WorkflowStatusController {
  const { ui, workflow, lineBreakOnStop = false } = args;
  let activeSpinner: ReturnType<typeof ora> | null = null;

  const stop = (): void => {
    if (activeSpinner === null) {
      return;
    }
    activeSpinner.stop();
    activeSpinner = null;
    if (lineBreakOnStop) {
      console.log();
    }
  };

  const startSpinner = (text: string): ReturnType<typeof ora> => {
    stop();
    activeSpinner = ora({
      text,
      spinner: "dots",
    }).start();
    return activeSpinner;
  };

  const completeSpinner = (spinner: ReturnType<typeof ora>, message: string): void => {
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
        startSpinner(event.message);
        return;
      }
      if (activeSpinner) {
        completeSpinner(activeSpinner, event.message);
        return;
      }
      status.success(event.message);
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
  console.log(color + `${DOT} ` + result.title + COLORS.reset);
  for (const line of result.body.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    console.log(color + `${DOT} ` + line + COLORS.reset);
  }
}

function deriveWorkflowLabel(title: string): string {
  const normalized = title.replace(/^CR\s+/i, "").trim();
  if (!normalized) {
    return "WORKFLOW";
  }
  return normalized.toUpperCase();
}

function printTaskHeader(title: string, description?: string): void {
  const workflowLabel = deriveWorkflowLabel(title);
  printHorizontalLine();
  console.log();
  console.log(COLORS.cyan + COLORS.bold + "> " + workflowLabel + COLORS.reset);
  if (description) {
    console.log(COLORS.dim + description + COLORS.reset);
  }
  console.log();
}

export async function runLiveTask(
  title: string,
  run: (controller: LiveController) => Promise<void>,
  description?: string
): Promise<void> {
  const controller = new LiveController();
  let renderedEventCount = 0;
  let runError: unknown;

  // Print header
  printTaskHeader(title, description);

  const dispose = effect(() => {
    const events = controller.events();
    while (renderedEventCount < events.length) {
      const evt = events[renderedEventCount];
      renderedEventCount += 1;
      const color = levelToColor(evt.level);
      console.log(color + `${DOT} ` + evt.message + COLORS.reset);
    }
  });

  try {
    await run(controller);
  } catch (error) {
    runError = error;
  } finally {
    controller.done();
    dispose();
  }

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
