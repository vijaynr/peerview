/**
 * GitHub client interface and factory.
 * Implementation lives in @cr/github; this module re-exports for backward compatibility.
 */
export type {
  CreatePullRequestParams,
  GitHubCommit,
  GitHubInlineComment,
  GitHubIssueComment,
  GitHubPr,
  GitHubPrDetails,
  GitHubPrFile,
  GitHubReview,
  GitHubReviewComment,
  PullRequestState,
  ReviewComment,
  ReviewEvent,
  UpdatePullRequestParams,
} from "@cr/github";
export { createGitHubClient, GitHubClient, isGitHubRemote, remoteToRepoPath } from "@cr/github";
