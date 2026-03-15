import { spawnSync } from "node:child_process";
import { CR_CONF_PATH, readCRConfigContents } from "@cr/core";
import { COLORS, createSpinner, DOT, printInfo, printRawOutput, printWarning } from "@cr/ui";

function resolveEditor(): string | undefined {
  return process.env.CR_EDITOR || process.env.VISUAL || process.env.EDITOR;
}

function openConfigInEditor(editor: string): void {
  const result = spawnSync(`${editor} "${CR_CONF_PATH}"`, {
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`Editor exited with code ${result.status}.`);
  }
}

export async function runConfigCommand(args: string[] = []): Promise<void> {
  const editMode = args.includes("--edit");

  createSpinner(editMode ? "Opening config..." : "Loading config...")
    .start()
    .stopAndPersist({
      symbol: COLORS.cyan + DOT + COLORS.reset,
      text: editMode ? "Open configuration in editor" : "Print configuration file",
    });

  if (editMode) {
    const editor = resolveEditor();
    if (!editor) {
      throw new Error("No terminal editor configured. Set CR_EDITOR, VISUAL, or EDITOR and retry.");
    }

    printInfo(`Opening ${CR_CONF_PATH} with ${editor}`);
    openConfigInEditor(editor);
    return;
  }

  const contents = await readCRConfigContents();
  if (contents === null) {
    printWarning(`Configuration file not found at ${CR_CONF_PATH}`);
    return;
  }

  printRawOutput(contents);
}
