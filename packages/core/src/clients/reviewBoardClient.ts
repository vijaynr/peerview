import { createReviewBoardClient as createClient } from "@pv/vcs/reviewboard";

export type { ReviewBoardClient } from "@pv/vcs/reviewboard";

/**
 * Creates a Review Board client using the standalone @pv/reviewboard package.
 */
export function createReviewBoardClient(baseUrl: string, token: string, username?: string) {
  return createClient(baseUrl, token, username);
}
