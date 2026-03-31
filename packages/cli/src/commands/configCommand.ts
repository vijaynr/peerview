import { spawnSync } from "node:child_process";
import { PV_CONF_PATH, readPVConfigContents } from "@pv/core";
import { COLORS, createSpinner, DOT, printInfo, printRawOutput, printWarning } from "@pv/tui";

function resolveEditor(): string | undefined {
  return process.env.PV_EDITOR || process.env.VISUAL || process.env.EDITOR;
}

function openConfigInEditor(editor: string): void {
  const result = spawnSync(`${editor} "${PV_CONF_PATH}"`, {
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
      throw new Error("No terminal editor configured. Set PV_EDITOR, VISUAL, or EDITOR and retry.");
    }

    printInfo(`Opening ${PV_CONF_PATH} with ${editor}`);
    openConfigInEditor(editor);
    return;
  }

  const contents = await readPVConfigContents();
  if (contents === null) {
    printWarning(`Configuration file not found at ${PV_CONF_PATH}`);
    return;
  }

  printRawOutput(contents);
}
