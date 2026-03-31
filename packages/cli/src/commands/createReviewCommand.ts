import path from "node:path";
import type { CreateReviewProvider, WorkflowMode } from "@pv/core";
import { repoRootFromModule } from "@pv/core";
import {
  createWorkflowStatusController,
  printCommandHelp,
  runLiveCreateReviewTask,
  runLiveTask,
} from "@pv/tui";
import { runCreateReviewWorkflow } from "@pv/workflows";
import { getFlag, hasFlag } from "../cliHelpers.js";

function resolveProvider(args: string[]): CreateReviewProvider {
  const gl = hasFlag(args, "gl");
  const reviewboard = hasFlag(args, "reviewboard");

  if (gl && reviewboard) {
    throw new Error("Pass only one provider flag: use either --gl or --reviewboard.");
  }

  if (reviewboard) {
    return "reviewboard";
  }

  return "gitlab";
}

export async function runCreateReviewCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printCommandHelp([
      {
        title: "USAGE",
        lines: ["pv create-review [options]"],
      },
      {
        title: "OPTIONS",
        lines: [
          "--path, -p <path>           Path to repository (default: current directory)",
          "--target-branch, -t <name>  Target branch for the GitLab merge request",
          "--mode, -m <mode>           Mode: interactive or ci (default: interactive)",
          "--gl                        Use GitLab merge request creation (default)",
          "--reviewboard               Use Review Board review request creation (SVN only)",
        ],
      },
      {
        title: "EXAMPLES",
        lines: [
          "pv create-review",
          "pv create-review --gl --target-branch main",
          "pv create-review --reviewboard --path /path/to/svn/wc",
          "pv create-review --mode ci --gl --target-branch main",
        ],
      },
    ]);
    return;
  }

  const mode: WorkflowMode =
    getFlag(args, "mode", "interactive", "-m") === "ci" ? "ci" : "interactive";
  const repoPath = path.resolve(getFlag(args, "path", ".", "-p"));
  const targetBranch = getFlag(args, "target-branch", "", "-t") || undefined;
  const provider = resolveProvider(args);
  const repoRoot = repoRootFromModule(import.meta.url);
  const entityLabel = provider === "reviewboard" ? "Review Request" : "Merge Request";
  const description =
    provider === "reviewboard"
      ? "Generate and publish a Review Board review request from local SVN changes."
      : "Generate or update a merge request draft from branch changes.";

  try {
    await runLiveTask(
      entityLabel,
      async (ui) => {
        const status = createWorkflowStatusController({ ui, workflow: "createReview" });
        await runLiveCreateReviewTask({
          repoPath,
          targetBranch,
          repoRoot,
          mode,
          ui,
          status,
          runWorkflow: (input) =>
            runCreateReviewWorkflow({
              ...input,
              provider,
            }),
        });
      },
      description
    );
  } catch {
    process.exitCode = 1;
  }
}
