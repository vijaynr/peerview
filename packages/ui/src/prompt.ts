import prompts from "prompts";
import { DOT } from "./constants.js";
import { printDivider } from "./console.js";

type PromptQuestions = Parameters<typeof prompts>[0];
type PromptOptions = Parameters<typeof prompts>[1];
type PromptResult = Awaited<ReturnType<typeof prompts>>;
export const abortOnCancel = { onCancel: () => false } satisfies PromptOptions;

// √ = Windows tick (U+221A), ✓ = Unix tick (U+2713), ✔ = heavy check (U+2714)
// ✖ = heavy cross (U+2716), ✗ = ballot X (U+2717), × = multiplication sign (U+00D7)
const TICK_RE = /[√✓✔]/g;
const CROSS_RE = /[✖✗×]/g;

/**
 * Wraps process.stdout.write for the duration of an async call, replacing
 * prompts' tick/cross symbols with our dot. Restored in a finally block so
 * the intercept is always scoped tightly to the prompt interaction.
 */
async function withDotSymbols<T>(fn: () => Promise<T>): Promise<T> {
  const orig = process.stdout.write.bind(process.stdout);

  (process.stdout as NodeJS.WriteStream).write = (
    chunk: Uint8Array | string,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void
  ): boolean => {
    if (typeof chunk === "string") {
      chunk = chunk.replace(TICK_RE, DOT).replace(CROSS_RE, DOT);
    }
    if (typeof encodingOrCb === "function") {
      return orig(chunk, encodingOrCb);
    }
    return orig(chunk, encodingOrCb as BufferEncoding, cb);
  };

  try {
    return await fn();
  } finally {
    process.stdout.write = orig;
  }
}

export async function promptWithFrame(
  questions: PromptQuestions,
  options?: PromptOptions
): Promise<PromptResult> {
  try {
    printDivider();
    return await withDotSymbols(() => prompts(questions, options));
  } finally {
    // intentionally empty
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
    abortOnCancel
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
    abortOnCancel
  );
  const feedback = String(feedbackAnswer.feedback ?? "").trim();
  return feedback || null;
}
