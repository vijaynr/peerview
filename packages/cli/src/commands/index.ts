import { printBanner, printHeaderBox } from "@cr/tui";

export async function runCommand(args: string[]): Promise<void> {
  const [command = "help", ...rest] = args;
  const showFullBanner = args.includes("--show-banner");
  const filteredRest = rest.filter((a) => a !== "--show-banner");

  if (showFullBanner) {
    await printBanner();
  }
  printHeaderBox();

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      {
        const { runHelpCommand } = await import("./helpCommand.js");
        await runHelpCommand();
      }
      return;
    case "init":
      {
        const { runInitCommand } = await import("./initCommand.js");
        await runInitCommand(filteredRest);
      }
      return;
    case "config":
      {
        const { runConfigCommand } = await import("./configCommand.js");
        await runConfigCommand(filteredRest);
      }
      return;
    case "review":
      {
        const { runReviewCommand } = await import("./reviewCommand.js");
        await runReviewCommand(filteredRest);
      }
      return;
    case "create-review":
      {
        const { runCreateReviewCommand } = await import("./createReviewCommand.js");
        await runCreateReviewCommand(filteredRest);
      }
      return;
    case "create-mr":
      {
        const { runCreateMergeRequestCommand } = await import("./createMrCommand.js");
        await runCreateMergeRequestCommand(filteredRest);
      }
      return;
    case "serve":
      {
        const { runServeCommand } = await import("./serveCommand.js");
        await runServeCommand(filteredRest);
      }
      return;
    default:
      console.error(`Unknown command: ${command}`);
      {
        const { runHelpCommand } = await import("./helpCommand.js");
        await runHelpCommand();
      }
      process.exitCode = 1;
  }
}
