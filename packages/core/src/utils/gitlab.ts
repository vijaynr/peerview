import { URL } from "node:url";
import type {
  GitLabBranch,
  GitLabCompare,
  GitLabMr,
  GitLabMrWithBasics,
  GitLabCommit,
  GitLabMrChangesResponse,
  GitLabDiscussion,
  GitLabInlineComment,
} from "../types/gitlab.js";
import { logger } from "./logger.js";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Converts a git remote URL to a GitLab project path.
 * Supports both SSH (git@gitlab.com:...) and HTTPS URLs.
 */
function remoteToProjectPath(remoteUrl: string): string {
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

    // Handle GitLab MR URLs by stripping the /-/merge_requests/... suffix
    const mrMarker = "/-/merge_requests/";
    if (path.includes(mrMarker)) {
      path = path.split(mrMarker)[0];
    }

    return path;
  }

  throw new Error(`Unsupported remote URL: ${remoteUrl}`);
}

export async function gitlabRequest<T>(
  baseUrl: string,
  token: string,
  endpoint: string,
  init?: RequestInit & { silent?: boolean }
): Promise<T> {
  const method = init?.method ?? "GET";
  const url = `${normalizeBaseUrl(baseUrl)}${endpoint}`;
  logger.debug("gitlab", `${method} ${endpoint}`);

  const { silent, ...fetchInit } = init ?? {};
  const response = await fetch(url, {
    ...fetchInit,
    headers: {
      "PRIVATE-TOKEN": token,
      "Content-Type": "application/json",
      ...(fetchInit?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (silent) {
      logger.trace("gitlab", `${method} ${endpoint} → ${response.status} (silent)`);
    } else {
      logger.error("gitlab", `${method} ${endpoint} → ${response.status}`, { body });
    }
    throw new Error(`GitLab API ${response.status}: ${body}`);
  }

  logger.trace("gitlab", `${method} ${endpoint} → ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Fetches a list of all branches in a GitLab project.
 * @param baseUrl GitLab instance URL
 * @param token GitLab API access token
 * @param projectPath Project path (e.g., "owner/repo")
 */
export async function getFileRaw(
  baseUrl: string,
  token: string,
  projectPath: string,
  filePath: string,
  ref: string
): Promise<string | null> {
  const encodedProject = encodeURIComponent(projectPath);
  const encodedPath = encodeURIComponent(filePath);
  const endpoint = `/api/v4/projects/${encodedProject}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(ref)}`;
  const url = `${normalizeBaseUrl(baseUrl)}${endpoint}`;

  logger.debug("gitlab", `getFileRaw: ${filePath} (ref: ${ref})`);

  const response = await fetch(url, {
    headers: {
      "PRIVATE-TOKEN": token,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    logger.error("gitlab", `getFileRaw failed: ${response.status}`, { body });
    throw new Error(`GitLab API ${response.status}: ${body}`);
  }

  return response.text();
}

export async function listBranches(
  baseUrl: string,
  token: string,
  projectPath: string
): Promise<string[]> {
  const encodedProject = encodeURIComponent(projectPath);
  const allBranches: string[] = [];
  let page = 1;

  while (true) {
    const result = await gitlabRequest<GitLabBranch[]>(
      baseUrl,
      token,
      `/api/v4/projects/${encodedProject}/repository/branches?per_page=100&page=${page}`
    );
    if (result.length === 0) break;
    allBranches.push(...result.map((b) => b.name));
    if (result.length < 100) break;
    page++;
  }

  logger.debug("gitlab", `listBranches: ${allBranches.length} branches fetched (${page} page(s))`);
  return allBranches;
}

export async function branchExists(
  baseUrl: string,
  token: string,
  projectPath: string,
  branchName: string
): Promise<boolean> {
  const encodedProject = encodeURIComponent(projectPath);
  const encodedBranch = encodeURIComponent(branchName);
  try {
    await gitlabRequest<GitLabBranch>(
      baseUrl,
      token,
      `/api/v4/projects/${encodedProject}/repository/branches/${encodedBranch}`,
      { silent: true }
    );
    logger.debug("gitlab", `branchExists: '${branchName}' → true`);
    return true;
  } catch {
    logger.debug("gitlab", `branchExists: '${branchName}' → false`);
    return false;
  }
}

export async function getProjectDefaultBranch(
  baseUrl: string,
  token: string,
  projectPath: string
): Promise<string> {
  const encodedProject = encodeURIComponent(projectPath);
  const project = await gitlabRequest<{ default_branch: string }>(
    baseUrl,
    token,
    `/api/v4/projects/${encodedProject}`
  );
  return project.default_branch;
}

/**
 * Lists merge requests in a GitLab project by state.
 * @param baseUrl GitLab instance URL
 * @param token GitLab API access token
 * @param projectPath Project path (e.g., "owner/repo")
 * @param state Filter by MR state: "opened", "closed", "merged", or "all"
 */
export async function listMergeRequests(
  baseUrl: string,
  token: string,
  projectPath: string,
  state: "opened" | "closed" | "merged" | "all"
): Promise<GitLabMrWithBasics[]> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests?state=${encodeURIComponent(state)}&per_page=100`;
  return gitlabRequest<GitLabMrWithBasics[]>(baseUrl, token, endpoint);
}

export async function findOpenMergeRequestBySourceBranch(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string
): Promise<GitLabMrWithBasics | null> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests?state=opened&source_branch=${encodeURIComponent(sourceBranch)}&per_page=1`;
  const mrs = await gitlabRequest<GitLabMrWithBasics[]>(baseUrl, token, endpoint);
  return mrs[0] ?? null;
}

export async function getMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<GitLabMrWithBasics> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}`;
  return gitlabRequest<GitLabMrWithBasics>(baseUrl, token, endpoint);
}

export async function getMergeRequestChanges(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<Array<{ old_path?: string; new_path?: string; diff?: string }>> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/changes`;
  const response = await gitlabRequest<GitLabMrChangesResponse>(baseUrl, token, endpoint);
  return response.changes ?? [];
}

export async function getMergeRequestCommits(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<GitLabCommit[]> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/commits?per_page=100`;
  return gitlabRequest<GitLabCommit[]>(baseUrl, token, endpoint);
}

export async function compareBranches(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string,
  targetBranch: string
): Promise<string> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/repository/compare?from=${encodeURIComponent(targetBranch)}&to=${encodeURIComponent(sourceBranch)}`;
  const compare = await gitlabRequest<GitLabCompare>(baseUrl, token, endpoint);
  const diffs = compare.diffs ?? [];
  const diffText = diffs.map((d) => d.diff ?? "").join("\n").trim();

  if (diffText) {
    return diffText;
  }

  // GitLab truncates diffs when the changeset is too large (compare_timeout) or too many files.
  // Fall back to commit messages so the LLM still has meaningful context.
  const commits = compare.commits ?? [];
  if (commits.length > 0) {
    logger.warn(
      "gitlab",
      `compareBranches: diffs empty (compare_timeout=${compare.compare_timeout}), falling back to ${commits.length} commit message(s)`
    );
    const commitLines = commits
      .map((c) => `- ${c.id.slice(0, 8)} ${c.title ?? c.message ?? ""}`.trim())
      .join("\n");
    return `## Commits (diff unavailable — changeset too large)\n\n${commitLines}`;
  }

  return "";
}

export async function findExistingMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string,
  targetBranch: string
): Promise<GitLabMr | null> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests?state=opened&source_branch=${encodeURIComponent(sourceBranch)}&target_branch=${encodeURIComponent(targetBranch)}&per_page=1`;
  const mrs = await gitlabRequest<GitLabMr[]>(baseUrl, token, endpoint);
  return mrs[0] ?? null;
}

export async function createMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string,
  targetBranch: string,
  title: string,
  description: string
): Promise<string> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests`;
  const mr = await gitlabRequest<GitLabMr>(baseUrl, token, endpoint, {
    method: "POST",
    body: JSON.stringify({
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title,
      description,
    }),
  });
  return mr.web_url;
}

export async function updateMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number,
  title: string,
  description: string
): Promise<string> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}`;
  const mr = await gitlabRequest<GitLabMr>(baseUrl, token, endpoint, {
    method: "PUT",
    body: JSON.stringify({ title, description }),
  });
  return mr.web_url;
}

export { remoteToProjectPath };
export type { GitLabInlineComment };
