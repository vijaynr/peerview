import { runCreateReviewCommand } from "./createReviewCommand.js";

export async function runCreateMergeRequestCommand(args: string[]): Promise<void> {
  await runCreateReviewCommand(["--gl", ...args]);
}
