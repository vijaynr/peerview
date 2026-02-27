import prompts from "prompts";
import { createRequire } from "node:module";
import { printHorizontalLine } from "./console.js";
import { COLORS, DOT } from "./constants.js";

type PromptQuestions = Parameters<typeof prompts>[0];
type PromptOptions = Parameters<typeof prompts>[1];
type PromptResult = Awaited<ReturnType<typeof prompts>>;
const require = createRequire(import.meta.url);
let didPatchPromptSymbols = false;

function patchPromptSymbols(): void {
  if (didPatchPromptSymbols) {
    return;
  }
  didPatchPromptSymbols = true;

  const setSymbolOverride = (style: {
    symbol?: (done: boolean, aborted: boolean, exited?: boolean) => string;
  }): void => {
    style.symbol = (done: boolean, aborted: boolean, exited?: boolean): string => {
      if (aborted) {
        return `${COLORS.red}${DOT}${COLORS.reset}`;
      }
      if (exited) {
        return `${COLORS.yellow}${DOT}${COLORS.reset}`;
      }
      if (done) {
        return `${COLORS.green}${DOT}${COLORS.reset}`;
      }
      return `${COLORS.cyan}${DOT}${COLORS.reset}`;
    };
  };

  try {
    setSymbolOverride(require("prompts/lib/util/style"));
    return;
  } catch {
    // Fall through to dist path for older runtime resolution.
  }

  try {
    setSymbolOverride(require("prompts/dist/util/style"));
  } catch {
    // Keep default prompt symbols if internal path changes.
  }
}

export async function promptWithFrame(
  questions: PromptQuestions,
  options?: PromptOptions
): Promise<PromptResult> {
  patchPromptSymbols();
  printHorizontalLine();
  console.log();
  try {
    return await prompts(questions, options);
  } finally {
    console.log();
    // printHorizontalLine();
  }
}

export async function askForOptionalFeedback(props: {
  confirmMessage: string;
  feedbackMessage?: string;
}): Promise<string | null> {
  const retry = await promptWithFrame(
    {
      type: "confirm",
      name: "redo",
      message: props.confirmMessage,
      initial: false,
    },
    { onCancel: () => true }
  );
  if (!retry.redo) {
    return null;
  }

  const feedbackAnswer = await promptWithFrame(
    {
      type: "text",
      name: "feedback",
      message: props.feedbackMessage ?? "Please enter your feedback (press Enter when done)",
    },
    { onCancel: () => true }
  );
  const feedback = String(feedbackAnswer.feedback ?? "").trim();
  return feedback || null;
}
