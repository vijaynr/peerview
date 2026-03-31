/**
 * GitHub client interface and factory.
 * Implementation lives in @pv/github; this module re-exports for backward compatibility.
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
} from "@pv/vcs/github";
export { createGitHubClient, GitHubClient, isGitHubRemote, remoteToRepoPath } from "@pv/vcs/github";
