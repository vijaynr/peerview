import { URL } from "node:url";
import type {
  GitHubBranch,
  GitHubCompare,
  GitHubPrWithBasics,
  GitHubCommit,
  GitHubPrFilesResponse,
  GitHubRepository,
} from "../types/github.js";
import { logger } from "./logger.js";

/**
 * Converts a git remote URL to a GitHub repository path (owner/repo).
 * Supports both SSH (git@github.com:...) and HTTPS URLs.
 */
export function remoteToGitHubRepoPath(remoteUrl: string): string {
  const sanitized = remoteUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");

  if (sanitized.startsWith("git@")) {
    const parts = sanitized.split(":", 2);
    if (parts.length < 2 || !parts[1]) {
      throw new Error(`Unsupported SSH remote URL: ${remoteUrl}`);
    }
    return parts[1];
  }

  if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
    const parsed = new URL(sanitized);
    let path = parsed.pathname.replace(/^\/+/, "");
    if (!path) {
      throw new Error(`Unsupported HTTP remote URL: ${remoteUrl}`);
    }

    // Handle GitHub PR URLs by stripping the /pull/... suffix
    const prMarker = "/pull/";
    if (path.includes(prMarker)) {
      path = path.split(prMarker)[0];
    }

    return path;
  }

  throw new Error(`Unsupported remote URL format: ${remoteUrl}`);
}

/**
 * Checks if a remote URL points to GitHub.
 */
export function isGitHubRemote(remoteUrl: string): boolean {
  const sanitized = remoteUrl.trim();
  
  if (sanitized.startsWith("git@github.com:")) {
    return true;
  }
  
  if (sanitized.startsWith("https://github.com/") || sanitized.startsWith("http://github.com/")) {
    return true;
  }
  
  return false;
}

async function githubApiRequest(
  endpoint: string,
  token: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = `https://api.github.com${endpoint}`;
  
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "CR-CLI",
  };
  
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  
  logger.debug("GitHub API", `${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

export async function listGitHubBranches(
  token: string,
  repoPath: string
): Promise<string[]> {
  const branches: GitHubBranch[] = await githubApiRequest(
    `/repos/${repoPath}/branches`,
    token
  );
  return branches.map((branch) => branch.name);
}

export async function getGitHubRepositoryInfo(
  token: string,
  repoPath: string
): Promise<GitHubRepository> {
  return githubApiRequest(`/repos/${repoPath}`, token);
}

export async function getGitHubDefaultBranch(
  token: string,
  repoPath: string
): Promise<string> {
  const repo = await getGitHubRepositoryInfo(token, repoPath);
  return repo.default_branch;
}

export async function githubBranchExists(
  token: string,
  repoPath: string,
  branchName: string
): Promise<boolean> {
  try {
    await githubApiRequest(`/repos/${repoPath}/branches/${branchName}`, token);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return false;
    }
    throw error;
  }
}

export async function listGitHubPullRequests(
  token: string,
  repoPath: string,
  state: "open" | "closed" | "all" = "open"
): Promise<GitHubPrWithBasics[]> {
  return githubApiRequest(`/repos/${repoPath}/pulls?state=${state}`, token);
}

export async function findOpenGitHubPullRequestByHead(
  token: string,
  repoPath: string,
  headBranch: string
): Promise<GitHubPrWithBasics | null> {
  const prs = await listGitHubPullRequests(token, repoPath, "open");
  
  for (const pr of prs) {
    // More detailed check would require fetching PR details
    const prDetail = await getGitHubPullRequest(token, repoPath, pr.number);
    if (prDetail.head?.ref === headBranch) {
      return prDetail;
    }
  }
  return null;
}

export async function getGitHubPullRequest(
  token: string,
  repoPath: string,
  prNumber: number
): Promise<GitHubPrWithBasics> {
  return githubApiRequest(`/repos/${repoPath}/pulls/${prNumber}`, token);
}

export async function getGitHubPullRequestFiles(
  token: string,
  repoPath: string,
  prNumber: number
): Promise<GitHubPrFilesResponse[]> {
  return githubApiRequest(`/repos/${repoPath}/pulls/${prNumber}/files`, token);
}

export async function getGitHubPullRequestCommits(
  token: string,
  repoPath: string,
  prNumber: number
): Promise<GitHubCommit[]> {
  return githubApiRequest(`/repos/${repoPath}/pulls/${prNumber}/commits`, token);
}

export async function getGitHubFileContent(
  token: string,
  repoPath: string,
  filePath: string,
  ref: string
): Promise<string | null> {
  try {
    const response = await githubApiRequest(`/repos/${repoPath}/contents/${filePath}?ref=${ref}`, token);
    if (response.content && response.encoding === "base64") {
      return Buffer.from(response.content, "base64").toString("utf-8");
    }
    return null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

export async function addGitHubPullRequestComment(
  token: string,
  repoPath: string,
  prNumber: number,
  body: string
): Promise<string> {
  const comment = await githubApiRequest(
    `/repos/${repoPath}/issues/${prNumber}/comments`,
    token,
    "POST",
    { body }
  );
  return comment.html_url;
}

export async function addGitHubInlinePullRequestComment(
  token: string,
  repoPath: string,
  prNumber: number,
  body: string,
  filePath: string,
  line: number,
  side: "LEFT" | "RIGHT"
): Promise<string> {
  // Get the PR to find the commit SHA
  const pr = await getGitHubPullRequest(token, repoPath, prNumber);
  const commitId = pr.head?.sha;
  
  if (!commitId) {
    throw new Error("Could not determine commit SHA for inline comment");
  }

  const comment = await githubApiRequest(
    `/repos/${repoPath}/pulls/${prNumber}/comments`,
    token,
    "POST",
    {
      body,
      path: filePath,
      line,
      side,
      commit_id: commitId,
    }
  );
  return comment.html_url;
}

export async function compareGitHubBranches(
  token: string,
  repoPath: string,
  baseBranch: string,
  headBranch: string
): Promise<string> {
  const compare: GitHubCompare = await githubApiRequest(
    `/repos/${repoPath}/compare/${baseBranch}...${headBranch}`,
    token
  );

  if (!compare.files || compare.files.length === 0) {
    return "";
  }

  // Convert GitHub patch format to a unified diff format similar to GitLab
  let diff = "";
  for (const file of compare.files) {
    if (file.patch) {
      diff += `--- ${file.previous_filename || file.filename}\n`;
      diff += `+++ ${file.filename}\n`;
      diff += file.patch + "\n";
    }
  }

  return diff;
}

export async function findExistingGitHubPullRequest(
  token: string,
  repoPath: string,
  headBranch: string,
  baseBranch: string
): Promise<{ number: number; html_url: string } | null> {
  const prs = await listGitHubPullRequests(token, repoPath, "open");
  
  for (const pr of prs) {
    const prDetail = await getGitHubPullRequest(token, repoPath, pr.number);
    if (prDetail.head?.ref === headBranch && prDetail.base?.ref === baseBranch) {
      return { number: pr.number, html_url: pr.html_url };
    }
  }
  
  return null;
}

export async function createGitHubPullRequest(
  token: string,
  repoPath: string,
  headBranch: string,
  baseBranch: string,
  title: string,
  body: string
): Promise<string> {
  const pr = await githubApiRequest(
    `/repos/${repoPath}/pulls`,
    token,
    "POST",
    {
      title,
      head: headBranch,
      base: baseBranch,
      body,
    }
  );
  return pr.html_url;
}

export async function updateGitHubPullRequest(
  token: string,
  repoPath: string,
  prNumber: number,
  title: string,
  body: string
): Promise<string> {
  const pr = await githubApiRequest(
    `/repos/${repoPath}/pulls/${prNumber}`,
    token,
    "PATCH",
    { title, body }
  );
  return pr.html_url;
}