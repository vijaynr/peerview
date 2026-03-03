import path from "node:path";
import { printCommandHelp } from "../ui/console.js";
import { createWorkflowStatusController, runLiveTask, runLiveCreateMrTask } from "../ui/main.js";
import { repoRootFromModule } from "../utils/paths.js";
import { getFlag } from "../utils/reviewCommandHelper.js";
import { runCreateMrWorkflow } from "../workflows/createMrWorkflow.js";
import type { WorkflowMode } from "../types/workflows.js";

export async function runCreateMergeRequestCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printCommandHelp([
      {
        title: "USAGE",
        lines: ["cr create-mr [options]"],
      },
      {
        title: "OPTIONS",
        lines: [
          "--path, -p <path>           Path to repository (default: current directory)",
          "--target-branch, -t <name>  Target branch for the merge request",
          "--mode, -m <mode>           Mode: interactive or ci (default: interactive)",
        ],
      },
      {
        title: "EXAMPLES",
        lines: [
          "cr create-mr",
          "cr create-mr --target-branch main",
          "cr create-mr --path /path/to/repo",
          "cr create-mr --mode ci --target-branch main",
        ],
      },
    ]);
    return;
  }

  const mode: WorkflowMode =
    getFlag(args, "mode", "interactive", "-m") === "ci" ? "ci" : "interactive";
  const repoPath = path.resolve(getFlag(args, "path", ".", "-p"));
  const targetBranch = getFlag(args, "target-branch", "", "-t") || undefined;
  const repoRoot = repoRootFromModule(import.meta.url);

  try {
    await runLiveTask(
      "Merge Request",
      async (ui) => {
        const status = createWorkflowStatusController({ ui, workflow: "createMr" });
        await runLiveCreateMrTask({
          repoPath,
          targetBranch,
          repoRoot,
          mode,
          ui,
          status,
          runWorkflow: runCreateMrWorkflow,
        });
      },
      "Generate or update a merge request draft from branch changes."
    );
  } catch {
    process.exitCode = 1;
  }
}
