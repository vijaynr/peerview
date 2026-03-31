/**
 * GitHub API utility functions.
 * Implementation lives in @pv/github (GitHubClient); this module provides
 * backward-compatible free-function wrappers for @pv/core consumers.
 */
import { GitHubClient } from "@pv/vcs/github";

export type { GitHubInlineComment, GitHubIssueComment } from "@pv/vcs/github";
export { isGitHubRemote, looksLikeConfiguredGitHub } from "@pv/vcs/github";

function client(token: string, baseUrl?: string): GitHubClient {
  return new GitHubClient(token, baseUrl);
}

/** @deprecated Use remoteToRepoPath from @pv/github instead */
export { remoteToRepoPath as remoteToGitHubRepoPath } from "@pv/vcs/github";

export function listGitHubBranches(token: string, repoPath: string): Promise<string[]> {
  return client(token).listBranches(repoPath);
}

export function getGitHubDefaultBranch(token: string, repoPath: string): Promise<string> {
  return client(token).getDefaultBranch(repoPath);
}

export function githubBranchExists(
  token: string,
  repoPath: string,
  branchName: string
): Promise<boolean> {
  return client(token).branchExists(repoPath, branchName);
}

export function listGitHubPullRequests(
  token: string,
  repoPath: string,
  state: "open" | "closed" | "all" = "open",
  baseUrl?: string
) {
  return client(token, baseUrl).listPullRequests(repoPath, state);
}

export function listGitHubRepositories(token: string, baseUrl?: string) {
  return client(token, baseUrl).listRepositories();
}

export function findOpenGitHubPullRequestByHead(
  token: string,
  repoPath: string,
  headBranch: string
) {
  return client(token).findOpenPullRequestByHead(repoPath, headBranch);
}

export function getGitHubPullRequest(token: string, repoPath: string, prNumber: number) {
  return client(token).getPullRequest(repoPath, prNumber);
}

export function getGitHubPullRequestFiles(token: string, repoPath: string, prNumber: number) {
  return client(token).getPullRequestFiles(repoPath, prNumber);
}

export function getGitHubPullRequestCommits(token: string, repoPath: string, prNumber: number) {
  return client(token).getPullRequestCommits(repoPath, prNumber);
}

export function getGitHubFileContent(
  token: string,
  repoPath: string,
  filePath: string,
  ref: string
): Promise<string | null> {
  return client(token).getFileContent(repoPath, filePath, ref);
}

export function addGitHubPullRequestComment(
  token: string,
  repoPath: string,
  prNumber: number,
  body: string
): Promise<string> {
  return client(token).addPullRequestComment(repoPath, prNumber, body);
}

export function updateGitHubPullRequestComment(
  token: string,
  repoPath: string,
  commentId: number,
  body: string
): Promise<string> {
  return client(token).updatePullRequestComment(repoPath, commentId, body);
}

export function deleteGitHubPullRequestComment(
  token: string,
  repoPath: string,
  commentId: number
): Promise<void> {
  return client(token).deletePullRequestComment(repoPath, commentId);
}

export function listGitHubIssueComments(
  token: string,
  repoPath: string,
  prNumber: number
): Promise<import("@pv/vcs/github").GitHubIssueComment[]> {
  return client(token).listIssueComments(repoPath, prNumber);
}

export function listGitHubReviewComments(
  token: string,
  repoPath: string,
  prNumber: number
): Promise<import("@pv/vcs/github").GitHubInlineComment[]> {
  return client(token).listReviewComments(repoPath, prNumber);
}

export function addGitHubInlinePullRequestComment(
  token: string,
  repoPath: string,
  prNumber: number,
  body: string,
  filePath: string,
  line: number,
  side: "LEFT" | "RIGHT"
): Promise<string> {
  return client(token).addInlineComment(repoPath, prNumber, body, filePath, line, undefined, side);
}

export function replyToGitHubReviewComment(
  token: string,
  repoPath: string,
  prNumber: number,
  commentId: number,
  body: string
): Promise<string> {
  return client(token).replyToReviewComment(repoPath, prNumber, commentId, body);
}

export function updateGitHubReviewComment(
  token: string,
  repoPath: string,
  commentId: number,
  body: string
): Promise<string> {
  return client(token).updateReviewComment(repoPath, commentId, body);
}

export function deleteGitHubReviewComment(
  token: string,
  repoPath: string,
  commentId: number
): Promise<void> {
  return client(token).deleteReviewComment(repoPath, commentId);
}

export function compareGitHubBranches(
  token: string,
  repoPath: string,
  baseBranch: string,
  headBranch: string
): Promise<string> {
  return client(token).compareBranches(repoPath, baseBranch, headBranch);
}

export function findExistingGitHubPullRequest(
  token: string,
  repoPath: string,
  headBranch: string,
  baseBranch: string
) {
  return client(token).findExistingPullRequest(repoPath, headBranch, baseBranch);
}

export async function createGitHubPullRequest(
  token: string,
  repoPath: string,
  headBranch: string,
  baseBranch: string,
  title: string,
  body: string
): Promise<string> {
  const pr = await client(token).createPullRequest(repoPath, {
    headBranch,
    baseBranch,
    title,
    body,
  });
  return pr.html_url;
}

export async function updateGitHubPullRequest(
  token: string,
  repoPath: string,
  prNumber: number,
  title: string,
  body: string
): Promise<string> {
  const pr = await client(token).updatePullRequest(repoPath, prNumber, { title, body });
  return pr.html_url;
}
