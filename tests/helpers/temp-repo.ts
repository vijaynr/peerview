import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

export async function createTempGitRepo(args?: {
  remoteUrl?: string;
  branch?: string;
}): Promise<{
  repoPath: string;
  branch: string;
  cleanup: () => Promise<void>;
}> {
  const repoPath = await fs.mkdtemp(path.join(os.tmpdir(), "cr-cli-int-repo-"));
  const branch = args?.branch ?? "feature/integration";
  const remoteUrl = args?.remoteUrl ?? "https://gitlab.local/group/project.git";

  git(["init"], repoPath);
  git(["config", "user.email", "integration@example.com"], repoPath);
  git(["config", "user.name", "integration-test"], repoPath);

  await fs.writeFile(path.join(repoPath, "README.md"), "# temp repo\n", "utf-8");
  git(["add", "."], repoPath);
  git(["commit", "-m", "initial commit"], repoPath);
  git(["checkout", "-b", branch], repoPath);
  git(["remote", "add", "origin", remoteUrl], repoPath);

  return {
    repoPath,
    branch,
    cleanup: async () => {
      await fs.rm(repoPath, { recursive: true, force: true });
    },
  };
}
