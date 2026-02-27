import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

async function git(args: string[], repoPath: string): Promise<string> {
  const cwd = path.resolve(repoPath);
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
  if (!branch || branch === "HEAD") {
    throw new Error("Could not determine current branch from repository.");
  }
  return branch;
}

export async function getOriginRemoteUrl(repoPath: string): Promise<string> {
  const url = await git(["remote", "get-url", "origin"], repoPath);
  if (!url) {
    throw new Error("Remote 'origin' not found.");
  }
  return url;
}
