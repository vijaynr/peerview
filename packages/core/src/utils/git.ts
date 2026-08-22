import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { isGitHubRemote } from "./github.js";
import { logger } from "./logger.js";

const execFileAsync = promisify(execFile);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function git(args: string[], repoPath: string): Promise<string> {
  const cwd = path.resolve(repoPath);
  logger.debug("git", `run: git ${args.join(" ")}`, { cwd });
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    const result = stdout.trim();
    logger.trace("git", `result: ${result.slice(0, 200)}`);
    return result;
  } catch (err) {
    logger.error(
      "git",
      `failed: git ${args.join(" ")}`,
      err instanceof Error ? err : new Error(String(err))
    );
    throw err;
  }
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  let branch: string;
  try {
    branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
  } catch (error) {
    const detail = errorMessage(error);
    if (detail.toLowerCase().includes("not a git repository")) {
      throw new Error(
        "Not a Git repository. Run this command from a Git working tree or pass --path <repository-path>."
      );
    }
    throw new Error(`Could not determine the current branch. ${detail}`);
  }
  if (!branch || branch === "HEAD") {
    throw new Error(
      "Detached HEAD detected. Check out a named local branch before creating a merge request."
    );
  }
  logger.debug("git", `current branch: ${branch}`);
  return branch;
}

export async function getOriginRemoteUrl(repoPath: string): Promise<string> {
  let url: string;
  try {
    url = await git(["remote", "get-url", "origin"], repoPath);
  } catch (error) {
    const detail = errorMessage(error);
    if (detail.toLowerCase().includes("no such remote")) {
      throw new Error(
        "Remote 'origin' not found. Add an origin remote before creating a merge request."
      );
    }
    throw new Error(`Could not read the 'origin' remote. ${detail}`);
  }
  if (!url) {
    throw new Error("Remote 'origin' not found.");
  }
  logger.debug("git", `origin remote url: ${url}`);
  return url;
}

/** Pushes the current local branch to origin and configures its upstream. */
export async function pushCurrentBranch(repoPath: string, branchName: string): Promise<void> {
  try {
    await git(["push", "--set-upstream", "origin", branchName], repoPath);
  } catch (error) {
    throw new Error(
      `Could not push '${branchName}' to origin. Check your remote permissions, branch protection rules, and network connection. ${errorMessage(error)}`
    );
  }
}

export async function hasUncommittedChanges(repoPath: string): Promise<boolean> {
  return Boolean(await git(["status", "--porcelain"], repoPath));
}

export type GitProvider = "github" | "gitlab" | "unknown";

/**
 * Determines the Git provider based on the origin remote URL.
 */
export async function detectGitProvider(repoPath: string): Promise<GitProvider> {
  try {
    const remoteUrl = await getOriginRemoteUrl(repoPath);

    if (isGitHubRemote(remoteUrl)) {
      return "github";
    }

    // Check for GitLab - this is more heuristic since GitLab can be self-hosted
    if (
      remoteUrl.includes("gitlab.com") ||
      remoteUrl.includes("gitlab") ||
      remoteUrl.includes("/-/merge_requests/")
    ) {
      return "gitlab";
    }

    return "unknown";
  } catch (error) {
    logger.warn(
      "git",
      "Could not detect git provider",
      error instanceof Error ? error : new Error(String(error))
    );
    return "unknown";
  }
}
