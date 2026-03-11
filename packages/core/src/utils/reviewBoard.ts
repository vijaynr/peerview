import {
  createReviewBoardClient,
  normalizeBaseUrl,
  reviewBoardToRequestId,
  rbRequest,
  getCurrentUser,
} from "@cr/reviewboard";
import type {
  ReviewBoardRequest,
  ReviewBoardRepository,
  ReviewBoardDiffSet,
  ReviewBoardFileDiff,
  ReviewBoardDiffData,
  ReviewBoardReview,
} from "@cr/reviewboard";

export { normalizeBaseUrl, reviewBoardToRequestId, rbRequest, getCurrentUser };

export async function listRepositories(
  baseUrl: string,
  token: string
): Promise<ReviewBoardRepository[]> {
  return createReviewBoardClient(baseUrl, token).listRepositories();
}

export async function listReviewRequests(
  baseUrl: string,
  token: string,
  status: "pending" | "submitted" | "all",
  fromUser?: string
): Promise<ReviewBoardRequest[]> {
  return createReviewBoardClient(baseUrl, token).listReviewRequests(status, fromUser);
}

export async function getReviewRequest(
  baseUrl: string,
  token: string,
  requestId: number
): Promise<ReviewBoardRequest> {
  return createReviewBoardClient(baseUrl, token).getReviewRequest(requestId);
}

export async function getLatestDiffSet(
  baseUrl: string,
  token: string,
  requestId: number
): Promise<ReviewBoardDiffSet | null> {
  return createReviewBoardClient(baseUrl, token).getLatestDiffSet(requestId);
}

export async function getFileDiffs(
  baseUrl: string,
  token: string,
  requestId: number,
  diffSetId: number
): Promise<ReviewBoardFileDiff[]> {
  return createReviewBoardClient(baseUrl, token).getFileDiffs(requestId, diffSetId);
}

export async function getFileDiffData(
  baseUrl: string,
  token: string,
  requestId: number,
  diffSetId: number,
  fileDiffId: number
): Promise<ReviewBoardDiffData> {
  return createReviewBoardClient(baseUrl, token).getFileDiffData(requestId, diffSetId, fileDiffId);
}

export async function createReviewRequest(
  baseUrl: string,
  token: string,
  repositoryId: number
): Promise<ReviewBoardRequest> {
  return createReviewBoardClient(baseUrl, token).createReviewRequest(repositoryId);
}

export async function updateReviewRequestDraft(
  baseUrl: string,
  token: string,
  requestId: number,
  fields: { summary?: string; description?: string }
): Promise<ReviewBoardRequest> {
  return createReviewBoardClient(baseUrl, token).updateReviewRequestDraft(requestId, fields);
}

export async function uploadReviewRequestDiff(
  baseUrl: string,
  token: string,
  requestId: number,
  diff: string,
  basedir?: string
): Promise<ReviewBoardDiffSet> {
  return createReviewBoardClient(baseUrl, token).uploadReviewRequestDiff(requestId, diff, basedir);
}

export async function publishReviewRequest(
  baseUrl: string,
  token: string,
  requestId: number
): Promise<ReviewBoardRequest> {
  return createReviewBoardClient(baseUrl, token).publishReviewRequest(requestId);
}

export async function createReview(
  baseUrl: string,
  token: string,
  requestId: number,
  bodyTop: string
): Promise<ReviewBoardReview> {
  return createReviewBoardClient(baseUrl, token).createReview(requestId, bodyTop);
}

export async function addDiffComment(
  baseUrl: string,
  token: string,
  requestId: number,
  reviewId: number,
  fileDiffId: number,
  firstLine: number,
  numLines: number,
  text: string
): Promise<void> {
  return createReviewBoardClient(baseUrl, token).addDiffComment(
    requestId,
    reviewId,
    fileDiffId,
    firstLine,
    numLines,
    text
  );
}

export async function publishReview(
  baseUrl: string,
  token: string,
  requestId: number,
  reviewId: number
): Promise<void> {
  return createReviewBoardClient(baseUrl, token).publishReview(requestId, reviewId);
}

export async function getRawDiff(
  baseUrl: string,
  token: string,
  requestId: number,
  revision: number
): Promise<string> {
  return createReviewBoardClient(baseUrl, token).getRawDiff(requestId, revision);
}
