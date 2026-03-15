import {
  githubBranchExists,
  compareGitHubBranches,
  createGitHubPullRequest,
  findExistingGitHubPullRequest,
  findOpenGitHubPullRequestByHead,
  getGitHubPullRequest,
  getGitHubPullRequestFiles,
  getGitHubPullRequestCommits,
  getGitHubDefaultBranch,
  listGitHubBranches,
  listGitHubPullRequests,
  updateGitHubPullRequest,
  getGitHubFileContent,
  addGitHubPullRequestComment,
  addGitHubInlinePullRequestComment,
} from "../utils/github.js";
import type { GitHubInlineComment } from "../types/github.js";
import type { MergeRequestState } from "../types/workflows.js";

export type { GitHubInlineComment };

export interface GitHubClient {
  listBranches(repoPath: string): Promise<string[]>;
  getDefaultBranch(repoPath: string): Promise<string>;
  branchExists(repoPath: string, branchName: string): Promise<boolean>;
  listPullRequests(
    repoPath: string,
    state: MergeRequestState
  ): Promise<
    Array<{ number: number; title: string; state: string; html_url: string; body?: string }>
  >;
  findOpenPullRequestByHead(
    repoPath: string,
    headBranch: string
  ): Promise<{ number: number; title: string; state: string; html_url: string } | null>;
  getPullRequest(
    repoPath: string,
    prNumber: number
  ): Promise<{
    number: number;
    title: string;
    state: string;
    html_url: string;
    body?: string;
    head?: { sha?: string; ref?: string };
    base?: { sha?: string; ref?: string };
  }>;
  getPullRequestFiles(
    repoPath: string,
    prNumber: number
  ): Promise<Array<{ filename: string; previous_filename?: string; patch?: string; status: string }>>;
  getPullRequestCommits(
    repoPath: string,
    prNumber: number
  ): Promise<Array<{ sha: string; message: string }>>;
  getFileContent(repoPath: string, filePath: string, ref: string): Promise<string | null>;
  // For inline comments, we'll implement these later when we add comment support
  // getPullRequestInlineComments(repoPath: string, prNumber: number): Promise<GitHubInlineComment[]>;
  addInlinePullRequestComment(
    repoPath: string,
    prNumber: number,
    body: string,
    filePath: string,
    line: number,
    side: "LEFT" | "RIGHT"
  ): Promise<string>;
  addPullRequestComment(repoPath: string, prNumber: number, body: string): Promise<string>;
  compareBranches(repoPath: string, baseBranch: string, headBranch: string): Promise<string>;
  findExistingPullRequest(
    repoPath: string,
    headBranch: string,
    baseBranch: string
  ): Promise<{ number: number; html_url: string } | null>;
  createPullRequest(
    repoPath: string,
    headBranch: string,
    baseBranch: string,
    title: string,
    body: string
  ): Promise<string>;
  updatePullRequest(
    repoPath: string,
    prNumber: number,
    title: string,
    body: string
  ): Promise<string>;
}

export function createGitHubClient(token: string): GitHubClient {
  return {
    listBranches: (repoPath) => listGitHubBranches(token, repoPath),
    getDefaultBranch: (repoPath) => getGitHubDefaultBranch(token, repoPath),
    branchExists: (repoPath, branchName) => githubBranchExists(token, repoPath, branchName),
    listPullRequests: (repoPath, state) => {
      const githubState = state === "opened" ? "open" : state === "closed" ? "closed" : "all";
      return listGitHubPullRequests(token, repoPath, githubState);
    },
    findOpenPullRequestByHead: (repoPath, headBranch) =>
      findOpenGitHubPullRequestByHead(token, repoPath, headBranch),
    getPullRequest: (repoPath, prNumber) => {
      return getGitHubPullRequest(token, repoPath, prNumber).then(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        html_url: pr.html_url,
        body: pr.body,
        head: pr.head,
        base: pr.base,
      }));
    },
    getPullRequestFiles: (repoPath, prNumber) => 
      getGitHubPullRequestFiles(token, repoPath, prNumber),
    getPullRequestCommits: (repoPath, prNumber) => 
      getGitHubPullRequestCommits(token, repoPath, prNumber).then(commits =>
        commits.map(commit => ({
          sha: commit.sha,
          message: commit.commit.message,
        }))
      ),
    getFileContent: (repoPath, filePath, ref) => 
      getGitHubFileContent(token, repoPath, filePath, ref),
    addInlinePullRequestComment: (repoPath, prNumber, body, filePath, line, side) =>
      addGitHubInlinePullRequestComment(token, repoPath, prNumber, body, filePath, line, side),
    addPullRequestComment: (repoPath, prNumber, body) =>
      addGitHubPullRequestComment(token, repoPath, prNumber, body),
    compareBranches: (repoPath, baseBranch, headBranch) =>
      compareGitHubBranches(token, repoPath, baseBranch, headBranch),
    findExistingPullRequest: (repoPath, headBranch, baseBranch) =>
      findExistingGitHubPullRequest(token, repoPath, headBranch, baseBranch),
    createPullRequest: (repoPath, headBranch, baseBranch, title, body) =>
      createGitHubPullRequest(token, repoPath, headBranch, baseBranch, title, body),
    updatePullRequest: (repoPath, prNumber, title, body) =>
      updateGitHubPullRequest(token, repoPath, prNumber, title, body),
  };
}