/**
 * GitHub API response types.
 * Implementation lives in @cr/github; this module re-exports for backward compatibility.
 */
export type {
  GitHubBranch,
  GitHubCommit,
  GitHubCompare,
  GitHubInlineComment,
  GitHubPr,
  GitHubPrDetails as GitHubPrWithBasics,
  GitHubPrFile as GitHubPrFilesResponse,
  GitHubRepository,
  GitHubReviewComment as GitHubPrReviewComment,
} from "@cr/github";
