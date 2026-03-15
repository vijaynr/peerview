export { GitHubClient, createGitHubClient, remoteToRepoPath, isGitHubRemote } from "./client.js";
export { GitHubHttpClient, GitHubApiError } from "./http-client.js";
export type { RequestOptions } from "./http-client.js";
export type {
  // Branches / repo
  GitHubBranch,
  GitHubRepository,
  // Pull requests
  PullRequestState,
  GitHubPr,
  GitHubPrDetails,
  CreatePullRequestParams,
  UpdatePullRequestParams,
  // Commits
  GitHubCommit,
  // Files / diff
  GitHubPrFile,
  GitHubCompare,
  GitHubFileContent,
  // Comments
  GitHubIssueComment,
  GitHubReviewComment,
  GitHubInlineComment,
  // Reviews
  ReviewEvent,
  GitHubReview,
  ReviewComment,
} from "./types.js";
