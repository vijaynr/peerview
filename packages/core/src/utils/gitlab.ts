import { GitLabClient, GitLabHttpClient } from "@pv/vcs/gitlab";

export type { GitLabInlineComment } from "@pv/vcs/gitlab";
export { remoteToProjectPath } from "@pv/vcs/gitlab";

// ---------------------------------------------------------------------------
// Legacy free-function API — thin wrappers around GitLabClient.
//
// These exports exist for backward compatibility with callers in @pv/core that
// still use the (baseUrl, token, ...) functional style.  New code should
// instantiate GitLabClient directly via createGitLabClient from @pv/gitlab.
// ---------------------------------------------------------------------------

function client(baseUrl: string, token: string): GitLabClient {
  return new GitLabClient(baseUrl, token);
}

export function gitlabRequest<T>(
  baseUrl: string,
  token: string,
  endpoint: string,
  init?: RequestInit & { silent?: boolean }
): Promise<T> {
  const method = (init?.method ?? "GET") as "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  const { silent } = init ?? {};
  let parsedBody: unknown;
  if (init?.body && typeof init.body === "string") {
    try {
      parsedBody = JSON.parse(init.body);
    } catch {
      parsedBody = init.body;
    }
  }
  return new GitLabHttpClient(baseUrl, token).request<T>(endpoint, {
    method,
    body: parsedBody,
    silent,
  });
}

export function getFileRaw(
  baseUrl: string,
  token: string,
  projectPath: string,
  filePath: string,
  ref: string
): Promise<string | null> {
  return client(baseUrl, token).getFileRaw(projectPath, filePath, ref);
}

export function listBranches(
  baseUrl: string,
  token: string,
  projectPath: string
): Promise<string[]> {
  return client(baseUrl, token).listBranches(projectPath);
}

export function branchExists(
  baseUrl: string,
  token: string,
  projectPath: string,
  branchName: string
): Promise<boolean> {
  return client(baseUrl, token).branchExists(projectPath, branchName);
}

export function getProjectDefaultBranch(
  baseUrl: string,
  token: string,
  projectPath: string
): Promise<string> {
  return client(baseUrl, token).getDefaultBranch(projectPath);
}

export function listMergeRequests(
  baseUrl: string,
  token: string,
  projectPath: string,
  state: "opened" | "closed" | "merged" | "all"
) {
  return client(baseUrl, token).listMergeRequests(projectPath, state);
}

export function listGitLabProjects(baseUrl: string, token: string) {
  return client(baseUrl, token).listProjects();
}

export function findOpenMergeRequestBySourceBranch(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string
) {
  return client(baseUrl, token).findOpenMergeRequestBySourceBranch(projectPath, sourceBranch);
}

export function getMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
) {
  return client(baseUrl, token).getMergeRequest(projectPath, mrIid);
}

export function getMergeRequestChanges(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
) {
  return client(baseUrl, token).getMergeRequestDiff(projectPath, mrIid);
}

export function getMergeRequestCommits(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
) {
  return client(baseUrl, token).getMergeRequestCommits(projectPath, mrIid);
}

export function compareBranches(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string,
  targetBranch: string
): Promise<string> {
  return client(baseUrl, token).compareBranches(projectPath, sourceBranch, targetBranch);
}

export function findExistingMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string,
  targetBranch: string
) {
  return client(baseUrl, token).findExistingMergeRequest(projectPath, sourceBranch, targetBranch);
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
  const mr = await client(baseUrl, token).createMergeRequest(projectPath, {
    sourceBranch,
    targetBranch,
    title,
    description,
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
  const mr = await client(baseUrl, token).updateMergeRequest(projectPath, mrIid, {
    title,
    description,
  });
  return mr.web_url;
}
