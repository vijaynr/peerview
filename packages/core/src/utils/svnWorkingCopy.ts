import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "./logger.js";

const execFileAsync = promisify(execFile);

async function svn(args: string[], repoPath: string, trimOutput: boolean = true): Promise<string> {
  const cwd = path.resolve(repoPath);
  logger.debug("svn", `run: svn ${args.join(" ")}`, { cwd });

  try {
    const { stdout } = await execFileAsync("svn", args, { cwd });
    const result = trimOutput ? stdout.trim() : stdout;
    logger.trace("svn", `result: ${result.slice(0, 200)}`);
    return result;
  } catch (error) {
    logger.error("svn", `failed: svn ${args.join(" ")}`, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

async function getSvnInfoItem(repoPath: string, item: string): Promise<string> {
  const value = await svn(["info", "--show-item", item], repoPath);
  if (!value) {
    throw new Error(`Could not determine SVN ${item} for working copy.`);
  }
  return value;
}

export async function isSvnWorkingCopy(repoPath: string): Promise<boolean> {
  try {
    await svn(["info"], repoPath);
    return true;
  } catch {
    return false;
  }
}

export async function getSvnDiff(repoPath: string): Promise<string> {
  return svn(["diff"], repoPath, false);
}

export async function getSvnRepoRootUrl(repoPath: string): Promise<string> {
  return getSvnInfoItem(repoPath, "repos-root-url");
}

export async function getSvnWorkingCopyUrl(repoPath: string): Promise<string> {
  return getSvnInfoItem(repoPath, "url");
}

export async function getSvnWorkingCopyRoot(repoPath: string): Promise<string> {
  return getSvnInfoItem(repoPath, "wc-root");
}
