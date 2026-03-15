import fs from "node:fs/promises";
import path from "node:path";
import type { GitLabClient } from "../clients/gitlabClient.js";
import type { SvnClient } from "../clients/svnClient.js";

const GUIDELINE_FILE_NAMES = ["GUIDELINES.md", "Guidelines.md", "guidelines.md"] as const;

async function tryReadLocalFile(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

export async function loadLocalRepositoryGuidelines(repoPath: string): Promise<string | undefined> {
  for (const fileName of GUIDELINE_FILE_NAMES) {
    const content = await tryReadLocalFile(path.join(repoPath, fileName));
    if (content) {
      return content;
    }
  }
  return undefined;
}

export async function loadGitLabRepositoryGuidelines(args: {
  gitlab: GitLabClient;
  projectPath: string;
  ref: string;
}): Promise<string | undefined> {
  for (const fileName of GUIDELINE_FILE_NAMES) {
    const content = await args.gitlab.getFileRaw(args.projectPath, fileName, args.ref);
    if (content) {
      return content;
    }
  }
  return undefined;
}

export async function loadSvnRepositoryGuidelines(
  svn: SvnClient | null
): Promise<string | undefined> {
  if (!svn) {
    return undefined;
  }

  for (const fileName of GUIDELINE_FILE_NAMES) {
    const content = await svn.getFile(fileName);
    if (content) {
      return content;
    }
  }
  return undefined;
}
