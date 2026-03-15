/**
 * GitHub API response types.
 * Implementation lives in @cr/github; this module re-exports for backward compatibility.
 */
export type {
  GitHubBranch,
  GitHubCompare,
  GitHubPrDetails as GitHubPrWithBasics,
  GitHubPr,
  GitHubCommit,
  GitHubPrFile as GitHubPrFilesResponse,
  GitHubRepository,
  GitHubReviewComment as GitHubPrReviewComment,
  GitHubInlineComment,
} from "@cr/github";