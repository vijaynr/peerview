import { ReviewBoardHttpClient } from "./http-client.js";
import type {
  ReviewBoardDiffData,
  ReviewBoardDiffSet,
  ReviewBoardFileDiff,
  ReviewBoardRepository,
  ReviewBoardRequest,
  ReviewBoardReview,
} from "./types.js";

// ---------------------------------------------------------------------------
// ReviewBoardClient class
// ---------------------------------------------------------------------------

export class ReviewBoardClient {
  private readonly http: ReviewBoardHttpClient;

  constructor(baseUrl: string, token: string, username?: string) {
    this.http = new ReviewBoardHttpClient(baseUrl, token, username);
  }

  // -------------------------------------------------------------------------
  // Repositories
  // -------------------------------------------------------------------------

  async listRepositories(): Promise<ReviewBoardRepository[]> {
    const response = await this.http.requestJSON<{ repositories: ReviewBoardRepository[] }>(
      "/api/repositories/?max-results=200"
    );
    return response.repositories ?? [];
  }

  async getRepository(repositoryHref: string): Promise<ReviewBoardRepository> {
    const response = await this.http.requestJSON<{ repository: ReviewBoardRepository }>(
      repositoryHref
    );
    return response.repository;
  }

  // -------------------------------------------------------------------------
  // Review Requests
  // -------------------------------------------------------------------------

  async listReviewRequests(
    status: "pending" | "submitted" | "all",
    fromUser?: string
  ): Promise<ReviewBoardRequest[]> {
    let endpoint = `/api/review-requests/?status=${status}&counts-only=0&max-results=200&expand=submitter`;
    if (fromUser) endpoint += `&from-user=${encodeURIComponent(fromUser)}`;

    const response = await this.http.requestJSON<{ review_requests: ReviewBoardRequest[] }>(
      endpoint
    );
    return response.review_requests ?? [];
  }

  async getReviewRequest(requestId: number): Promise<ReviewBoardRequest> {
    const response = await this.http.requestJSON<{ review_request: ReviewBoardRequest }>(
      `/api/review-requests/${requestId}/?expand=submitter,repository`
    );

    const request = response.review_request;
    // Hydrate the repository path when it comes back as a link rather than inline
    if (!request.repository?.path && request.links.repository?.href) {
      request.repository = await this.getRepository(request.links.repository.href);
    }

    return request;
  }

  async createReviewRequest(repositoryId: number): Promise<ReviewBoardRequest> {
    const response = await this.http.requestFormEncoded<{ review_request: ReviewBoardRequest }>(
      "/api/review-requests/",
      "POST",
      { repository: repositoryId.toString() }
    );
    return response.review_request;
  }

  async updateReviewRequestDraft(
    requestId: number,
    fields: { summary?: string; description?: string }
  ): Promise<ReviewBoardRequest> {
    const params: Record<string, string> = {};
    if (fields.summary !== undefined) params["summary"] = fields.summary;
    if (fields.description !== undefined) {
      params["description"] = fields.description;
      params["description_text_type"] = "markdown";
    }

    const response = await this.http.requestFormEncoded<{ review_request: ReviewBoardRequest }>(
      `/api/review-requests/${requestId}/draft/`,
      "PUT",
      params
    );
    return response.review_request;
  }

  async uploadReviewRequestDiff(
    requestId: number,
    diff: string,
    basedir?: string
  ): Promise<ReviewBoardDiffSet> {
    const form = new FormData();
    form.set("path", new Blob([diff], { type: "text/x-patch" }), "review.diff");
    if (basedir) form.set("basedir", basedir);

    const response = await this.http.requestMultipart<{ diff: ReviewBoardDiffSet }>(
      `/api/review-requests/${requestId}/draft/diffs/`,
      form
    );
    return response.diff;
  }

  async publishReviewRequest(requestId: number): Promise<ReviewBoardRequest> {
    const response = await this.http.requestFormEncoded<{ review_request: ReviewBoardRequest }>(
      `/api/review-requests/${requestId}/draft/`,
      "PUT",
      { public: "1" }
    );
    return response.review_request;
  }

  // -------------------------------------------------------------------------
  // Diffs
  // -------------------------------------------------------------------------

  async getLatestDiffSet(requestId: number): Promise<ReviewBoardDiffSet | null> {
    const response = await this.http.requestJSON<{ diffs: ReviewBoardDiffSet[] }>(
      `/api/review-requests/${requestId}/diffs/`
    );
    const diffs = response.diffs ?? [];
    return diffs.length > 0 ? diffs[diffs.length - 1]! : null;
  }

  async getFileDiffs(requestId: number, diffSetId: number): Promise<ReviewBoardFileDiff[]> {
    const response = await this.http.requestJSON<{ files: ReviewBoardFileDiff[] }>(
      `/api/review-requests/${requestId}/diffs/${diffSetId}/files/`
    );
    return response.files ?? [];
  }

  async getFileDiffData(
    requestId: number,
    diffSetId: number,
    fileDiffId: number
  ): Promise<ReviewBoardDiffData> {
    const response = await this.http.requestJSON<{ diff_data: ReviewBoardDiffData }>(
      `/api/review-requests/${requestId}/diffs/${diffSetId}/files/${fileDiffId}/diff-data/`
    );
    return response.diff_data;
  }

  /**
   * Downloads the raw unified diff for a specific revision as plain text.
   */
  async getRawDiff(requestId: number, revision: number): Promise<string> {
    return this.http.requestText(`/api/review-requests/${requestId}/diffs/${revision}/`);
  }

  // -------------------------------------------------------------------------
  // Reviews and Comments
  // -------------------------------------------------------------------------

  async createReview(requestId: number, bodyTop: string): Promise<ReviewBoardReview> {
    const response = await this.http.requestFormEncoded<{ review: ReviewBoardReview }>(
      `/api/review-requests/${requestId}/reviews/`,
      "POST",
      { body_top: bodyTop }
    );
    return response.review;
  }

  async addDiffComment(
    requestId: number,
    reviewId: number,
    fileDiffId: number,
    firstLine: number,
    numLines: number,
    text: string
  ): Promise<void> {
    await this.http.requestFormEncoded(
      `/api/review-requests/${requestId}/reviews/${reviewId}/diff-comments/`,
      "POST",
      {
        filediff_id: fileDiffId.toString(),
        first_line: firstLine.toString(),
        num_lines: numLines.toString(),
        text,
      }
    );
  }

  async publishReview(requestId: number, reviewId: number): Promise<void> {
    await this.http.requestFormEncoded(
      `/api/review-requests/${requestId}/reviews/${reviewId}/`,
      "PUT",
      { public: "1" }
    );
  }

  /**
   * Convenience method: creates a review, attaches inline diff comments,
   * and publishes it in one call.
   */
  async postReview(
    requestId: number,
    summary: string,
    inlineComments: Array<{
      fileDiffId: number;
      line: number;
      text: string;
      numLines?: number;
    }> = []
  ): Promise<ReviewBoardReview> {
    const review = await this.createReview(requestId, summary);
    for (const comment of inlineComments) {
      await this.addDiffComment(
        requestId,
        review.id,
        comment.fileDiffId,
        comment.line,
        comment.numLines ?? 1,
        comment.text
      );
    }
    await this.publishReview(requestId, review.id);
    return review;
  }

  // -------------------------------------------------------------------------
  // Session / User
  // -------------------------------------------------------------------------

  async getCurrentUser(): Promise<{ id: number; username: string; fullname: string }> {
    const sessionResponse = await this.http.requestJSON<{
      session: {
        authenticated: boolean;
        links: { user: { href: string; title: string } };
      };
    }>("/api/session/");

    if (!sessionResponse.session.authenticated) {
      throw new Error("Review Board session is not authenticated. Please check your token.");
    }

    const userHref = sessionResponse.session.links.user.href;
    const userResponse = await this.http.requestJSON<{
      user: { id: number; username: string; fullname: string };
    }>(userHref);
    return userResponse.user;
  }
}

// ---------------------------------------------------------------------------
// Factory (backward-compatible)
// ---------------------------------------------------------------------------

/** Creates a new ReviewBoardClient for the given instance URL and credentials. */
export function createReviewBoardClient(
  baseUrl: string,
  token: string,
  username?: string
): ReviewBoardClient {
  return new ReviewBoardClient(baseUrl, token, username);
}

// ---------------------------------------------------------------------------
// Legacy free-function exports (backward-compatible shims)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use ReviewBoardClient directly or createReviewBoardClient instead.
 */
export async function rbRequest<T>(
  baseUrl: string,
  token: string,
  endpoint: string,
  init?: RequestInit,
  username?: string
): Promise<T> {
  const http = new ReviewBoardHttpClient(baseUrl, token, username);
  return http.requestJSON<T>(endpoint, init ?? {});
}

/**
 * @deprecated Use ReviewBoardClient.getCurrentUser() instead.
 */
export async function getCurrentUser(
  baseUrl: string,
  token: string,
  username?: string
): Promise<{ id: number; username: string; fullname: string }> {
  return new ReviewBoardClient(baseUrl, token, username).getCurrentUser();
}

/**
 * @deprecated Use ReviewBoardClient.listRepositories() instead.
 */
export async function listRepositories(
  baseUrl: string,
  token: string
): Promise<ReviewBoardRepository[]> {
  return new ReviewBoardClient(baseUrl, token).listRepositories();
}

/**
 * @deprecated Use ReviewBoardClient.listReviewRequests() instead.
 */
export async function listReviewRequests(
  baseUrl: string,
  token: string,
  status: "pending" | "submitted" | "all",
  fromUser?: string
): Promise<ReviewBoardRequest[]> {
  return new ReviewBoardClient(baseUrl, token).listReviewRequests(status, fromUser);
}

/**
 * @deprecated Use ReviewBoardClient.getReviewRequest() instead.
 */
export async function getReviewRequest(
  baseUrl: string,
  token: string,
  requestId: number
): Promise<ReviewBoardRequest> {
  return new ReviewBoardClient(baseUrl, token).getReviewRequest(requestId);
}

/**
 * @deprecated Use ReviewBoardClient.getLatestDiffSet() instead.
 */
export async function getLatestDiffSet(
  baseUrl: string,
  token: string,
  requestId: number
): Promise<ReviewBoardDiffSet | null> {
  return new ReviewBoardClient(baseUrl, token).getLatestDiffSet(requestId);
}

/**
 * @deprecated Use ReviewBoardClient.getFileDiffs() instead.
 */
export async function getFileDiffs(
  baseUrl: string,
  token: string,
  requestId: number,
  diffSetId: number
): Promise<ReviewBoardFileDiff[]> {
  return new ReviewBoardClient(baseUrl, token).getFileDiffs(requestId, diffSetId);
}

/**
 * @deprecated Use ReviewBoardClient.getFileDiffData() instead.
 */
export async function getFileDiffData(
  baseUrl: string,
  token: string,
  requestId: number,
  diffSetId: number,
  fileDiffId: number
): Promise<ReviewBoardDiffData> {
  return new ReviewBoardClient(baseUrl, token).getFileDiffData(requestId, diffSetId, fileDiffId);
}

/**
 * @deprecated Use ReviewBoardClient.createReviewRequest() instead.
 */
export async function createReviewRequest(
  baseUrl: string,
  token: string,
  repositoryId: number
): Promise<ReviewBoardRequest> {
  return new ReviewBoardClient(baseUrl, token).createReviewRequest(repositoryId);
}

/**
 * @deprecated Use ReviewBoardClient.updateReviewRequestDraft() instead.
 */
export async function updateReviewRequestDraft(
  baseUrl: string,
  token: string,
  requestId: number,
  fields: { summary?: string; description?: string }
): Promise<ReviewBoardRequest> {
  return new ReviewBoardClient(baseUrl, token).updateReviewRequestDraft(requestId, fields);
}

/**
 * @deprecated Use ReviewBoardClient.uploadReviewRequestDiff() instead.
 */
export async function uploadReviewRequestDiff(
  baseUrl: string,
  token: string,
  requestId: number,
  diff: string,
  basedir?: string
): Promise<ReviewBoardDiffSet> {
  return new ReviewBoardClient(baseUrl, token).uploadReviewRequestDiff(requestId, diff, basedir);
}

/**
 * @deprecated Use ReviewBoardClient.publishReviewRequest() instead.
 */
export async function publishReviewRequest(
  baseUrl: string,
  token: string,
  requestId: number
): Promise<ReviewBoardRequest> {
  return new ReviewBoardClient(baseUrl, token).publishReviewRequest(requestId);
}

/**
 * @deprecated Use ReviewBoardClient.createReview() instead.
 */
export async function createReview(
  baseUrl: string,
  token: string,
  requestId: number,
  bodyTop: string
): Promise<ReviewBoardReview> {
  return new ReviewBoardClient(baseUrl, token).createReview(requestId, bodyTop);
}

/**
 * @deprecated Use ReviewBoardClient.addDiffComment() instead.
 */
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
  return new ReviewBoardClient(baseUrl, token).addDiffComment(
    requestId,
    reviewId,
    fileDiffId,
    firstLine,
    numLines,
    text
  );
}

/**
 * @deprecated Use ReviewBoardClient.publishReview() instead.
 */
export async function publishReview(
  baseUrl: string,
  token: string,
  requestId: number,
  reviewId: number
): Promise<void> {
  return new ReviewBoardClient(baseUrl, token).publishReview(requestId, reviewId);
}
