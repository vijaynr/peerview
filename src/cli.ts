#!/usr/bin/env bun
import { runCommand } from "./commands/index.js";
import { printAlert, printError, printWarning } from "./ui/console.js";
import { formatKnownNetworkError } from "./utils/errors.js";

async function main(): Promise<void> {
  process.once("SIGINT", () => {
    console.log();
    printWarning("Operation cancelled by user.");
    process.exit(0);
  });

  const args = process.argv.slice(2);
  await runCommand(args);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const knownNetworkError = formatKnownNetworkError(message);
  if (knownNetworkError) {
    printAlert({
      title: knownNetworkError.title,
      message: knownNetworkError.body,
      tone: "error",
    });
  } else {
    printError(`cr error: ${message}`);
  }
  process.exitCode = 1;
});
