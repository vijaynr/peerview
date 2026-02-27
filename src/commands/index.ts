import { printBanner } from "../ui/console.js";

export async function runCommand(args: string[]): Promise<void> {
  const [command = "help", ...rest] = args;
  await printBanner();

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      {
        const { runHelpCommand } = await import("./help.js");
        await runHelpCommand();
      }
      return;
    case "init":
      {
        const { runInitCommand } = await import("./init.js");
        await runInitCommand();
      }
      return;
    case "review":
      {
        const { runReviewCommand } = await import("./review.js");
        await runReviewCommand(rest);
      }
      return;
    default:
      console.error(`Unknown command: ${command}`);
      {
        const { runHelpCommand } = await import("./help.js");
        await runHelpCommand();
      }
      process.exitCode = 1;
  }
}
