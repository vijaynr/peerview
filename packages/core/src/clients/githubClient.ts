/**
 * GitHub client interface and factory.
 * Implementation lives in @cr/github; this module re-exports for backward compatibility.
 */
export type {
  GitHubInlineComment,
  GitHubPrDetails,
  GitHubPr,
  GitHubCommit,
  GitHubPrFile,
  GitHubIssueComment,
  GitHubReviewComment,
  GitHubReview,
  PullRequestState,
  CreatePullRequestParams,
  UpdatePullRequestParams,
  ReviewComment,
  ReviewEvent,
} from "@cr/github";
export { GitHubClient, createGitHubClient, remoteToRepoPath, isGitHubRemote } from "@cr/github";