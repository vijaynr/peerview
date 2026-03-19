import { URL } from "node:url";
import { GitHubApiError, GitHubHttpClient } from "./http-client.js";
import type {
  CreatePullRequestParams,
  GitHubBranch,
  GitHubCommit,
  GitHubCompare,
  GitHubFileContent,
  GitHubInlineComment,
  GitHubIssueComment,
  GitHubPr,
  GitHubPrDetails,
  GitHubPrFile,
  GitHubRepository,
  GitHubReview,
  GitHubReviewComment,
  PullRequestState,
  ReviewComment,
  ReviewEvent,
  UpdatePullRequestParams,
} from "./types.js";

export type {
  CreatePullRequestParams,
  GitHubInlineComment,
  PullRequestState,
  ReviewComment,
  ReviewEvent,
  UpdatePullRequestParams,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a git remote URL (SSH or HTTPS) to a GitHub repository path (owner/repo).
 * Examples:
 *   git@github.com:owner/repo.git  →  owner/repo
 *   https://github.com/owner/repo  →  owner/repo
 */
export function remoteToRepoPath(remoteUrl: string): string {
  const sanitized = remoteUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");

  if (sanitized.startsWith("git@")) {
    const parts = sanitized.split(":", 2);
    if (parts.length < 2 || !parts[1]) {
      throw new Error(`Unsupported SSH remote URL: ${remoteUrl}`);
    }
    return parts[1];
  }

  if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
    const parsed = new URL(sanitized);
    let path = parsed.pathname.replace(/^\/+/, "");
    if (!path) {
      throw new Error(`Unsupported HTTP remote URL: ${remoteUrl}`);
    }
    // Strip /pull/... suffix that may appear in copied PR URLs
    const prMarker = "/pull/";
    if (path.includes(prMarker)) {
      path = path.split(prMarker)[0]!;
    }
    return path;
  }

  throw new Error(`Unsupported remote URL format: ${remoteUrl}`);
}

/** Returns true if the remote URL points to GitHub.com. */
export function isGitHubRemote(remoteUrl: string): boolean {
  const s = remoteUrl.trim();
  return (
    s.startsWith("git@github.com:") ||
    s.startsWith("https://github.com/") ||
    s.startsWith("http://github.com/")
  );
}

/**
 * Returns true if the remote URL points to a GitHub instance — either github.com
 * or a GitHub Enterprise Server at the given configured base URL.
 */
export function looksLikeConfiguredGitHub(remoteUrl: string, githubUrl: string): boolean {
  if (isGitHubRemote(remoteUrl)) {
    return true;
  }

  if (!githubUrl) {
    return false;
  }

  try {
    const configuredHost = new URL(githubUrl).hostname.toLowerCase();
    const remoteHost = remoteUrl.toLowerCase();
    return (
      remoteHost.includes(configuredHost) ||
      remoteUrl.startsWith(`git@${configuredHost}:`)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GitHubClient
// ---------------------------------------------------------------------------

export class GitHubClient {
  private readonly http: GitHubHttpClient;

  constructor(token: string, baseUrl?: string) {
    this.http = new GitHubHttpClient(token, baseUrl);
  }

  // -------------------------------------------------------------------------
  // Branches
  // -------------------------------------------------------------------------

  /** Lists all branch names in a repository (auto-paginates up to 1000). */
  async listBranches(repoPath: string): Promise<string[]> {
    const branches: string[] = [];
    let page = 1;

    while (true) {
      const result = await this.http.get<GitHubBranch[]>(
        `/repos/${repoPath}/branches?per_page=100&page=${page}`
      );
      if (result.length === 0) break;
      branches.push(...result.map((b) => b.name));
      if (result.length < 100) break;
      page++;
    }

    return branches;
  }

  /** Returns the default branch name for a repository. */
  async getDefaultBranch(repoPath: string): Promise<string> {
    const repo = await this.http.get<GitHubRepository>(`/repos/${repoPath}`);
    return repo.default_branch;
  }

  /** Returns true if the named branch exists. */
  async branchExists(repoPath: string, branchName: string): Promise<boolean> {
    try {
      await this.http.get<GitHubBranch>(
        `/repos/${repoPath}/branches/${encodeURIComponent(branchName)}`,
        { notFoundReturnsNull: true }
      );
      return true;
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 404) return false;
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Repository
  // -------------------------------------------------------------------------

  /** Lists repositories the authenticated user can review and collaborate on. */
  async listRepositories(): Promise<GitHubRepository[]> {
    const repositories: GitHubRepository[] = [];
    let page = 1;

    while (true) {
      const result = await this.http.get<GitHubRepository[]>(
        `/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100&page=${page}`
      );

      if (result.length === 0) {
        break;
      }

      repositories.push(...result);

      if (result.length < 100) {
        break;
      }

      page += 1;
    }

    return repositories;
  }

  /**
   * Returns raw file content at a specific ref.
   * Returns null if the file does not exist (404).
   */
  async getFileContent(repoPath: string, filePath: string, ref: string): Promise<string | null> {
    const response = await this.http.get<GitHubFileContent | null>(
      `/repos/${repoPath}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`,
      { notFoundReturnsNull: true }
    );
    if (!response) return null;
    if (response.encoding === "base64") {
      // Node/Bun — Buffer is available globally
      return Buffer.from(response.content.replace(/\n/g, ""), "base64").toString("utf-8");
    }
    return response.content;
  }

  /**
   * Compares two branches and returns a unified diff string.
   */
  async compareBranches(repoPath: string, baseBranch: string, headBranch: string): Promise<string> {
    const compare = await this.http.get<GitHubCompare>(
      `/repos/${repoPath}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(headBranch)}`
    );

    if (!compare.files || compare.files.length === 0) return "";

    return compare.files
      .filter((f) => f.patch)
      .map((f) => {
        const prev = f.previous_filename ?? f.filename;
        return `--- ${prev}\n+++ ${f.filename}\n${f.patch}`;
      })
      .join("\n");
  }

  // -------------------------------------------------------------------------
  // Pull Requests — Read
  // -------------------------------------------------------------------------

  /**
   * Lists pull requests filtered by state.
   * Note: GitHub uses "open"/"closed"/"all" rather than GitLab's "opened"/"merged".
   */
  async listPullRequests(
    repoPath: string,
    state: PullRequestState = "open"
  ): Promise<GitHubPrDetails[]> {
    return this.http.get<GitHubPrDetails[]>(`/repos/${repoPath}/pulls?state=${state}&per_page=100`);
  }

  /**
   * Finds the first open PR whose head branch matches.
   * Uses the API search endpoint for efficiency.
   */
  async findOpenPullRequestByHead(
    repoPath: string,
    headBranch: string
  ): Promise<GitHubPrDetails | null> {
    const prs = await this.http.get<GitHubPrDetails[]>(
      `/repos/${repoPath}/pulls?state=open&head=${encodeURIComponent(headBranch)}&per_page=1`
    );
    // GitHub's head filter uses "owner:branch" format — fall back to manual filter
    if (prs.length > 0 && prs[0]!.head.ref === headBranch) return prs[0]!;

    // Manual search (handles cases where the head filter returns owner:branch mismatches)
    const all = await this.listPullRequests(repoPath, "open");
    return all.find((pr) => pr.head.ref === headBranch) ?? null;
  }

  /**
   * Finds an open PR matching both head and base branches exactly.
   */
  async findExistingPullRequest(
    repoPath: string,
    headBranch: string,
    baseBranch: string
  ): Promise<GitHubPr | null> {
    const all = await this.listPullRequests(repoPath, "open");
    const match = all.find((pr) => pr.head.ref === headBranch && pr.base.ref === baseBranch);
    return match ? { number: match.number, html_url: match.html_url } : null;
  }

  /**
   * Returns full details of a single pull request by number.
   */
  async getPullRequest(repoPath: string, prNumber: number): Promise<GitHubPrDetails> {
    return this.http.get<GitHubPrDetails>(`/repos/${repoPath}/pulls/${prNumber}`);
  }

  /**
   * Returns the list of files changed in a pull request.
   */
  async getPullRequestFiles(repoPath: string, prNumber: number): Promise<GitHubPrFile[]> {
    return this.http.get<GitHubPrFile[]>(`/repos/${repoPath}/pulls/${prNumber}/files?per_page=100`);
  }

  /**
   * Returns all commits included in a pull request.
   */
  async getPullRequestCommits(repoPath: string, prNumber: number): Promise<GitHubCommit[]> {
    return this.http.get<GitHubCommit[]>(
      `/repos/${repoPath}/pulls/${prNumber}/commits?per_page=100`
    );
  }

  // -------------------------------------------------------------------------
  // Pull Requests — Create / Update
  // -------------------------------------------------------------------------

  /**
   * Creates a new pull request and returns its full details.
   */
  async createPullRequest(
    repoPath: string,
    params: CreatePullRequestParams
  ): Promise<GitHubPrDetails> {
    return this.http.post<GitHubPrDetails>(`/repos/${repoPath}/pulls`, {
      title: params.title,
      body: params.body ?? "",
      head: params.headBranch,
      base: params.baseBranch,
      draft: params.draft,
      maintainer_can_modify: params.maintainerCanModify,
    });
  }

  /**
   * Updates fields on an existing pull request.
   */
  async updatePullRequest(
    repoPath: string,
    prNumber: number,
    params: UpdatePullRequestParams
  ): Promise<GitHubPrDetails> {
    return this.http.patch<GitHubPrDetails>(`/repos/${repoPath}/pulls/${prNumber}`, {
      title: params.title,
      body: params.body,
      state: params.state,
      base: params.base,
    });
  }

  /**
   * Updates only the body (description) of a pull request.
   */
  async updatePullRequestBody(
    repoPath: string,
    prNumber: number,
    body: string
  ): Promise<GitHubPrDetails> {
    return this.updatePullRequest(repoPath, prNumber, { body });
  }

  // -------------------------------------------------------------------------
  // Issue Comments (general PR comments)
  // -------------------------------------------------------------------------

  /**
   * Returns all general (non-review) comments on a pull request.
   */
  async listIssueComments(repoPath: string, prNumber: number): Promise<GitHubIssueComment[]> {
    return this.http.get<GitHubIssueComment[]>(
      `/repos/${repoPath}/issues/${prNumber}/comments?per_page=100`
    );
  }

  /**
   * Posts a top-level comment on the pull request.
   * Returns the comment's HTML URL.
   */
  async addPullRequestComment(repoPath: string, prNumber: number, body: string): Promise<string> {
    const comment = await this.http.post<GitHubIssueComment>(
      `/repos/${repoPath}/issues/${prNumber}/comments`,
      { body }
    );
    return comment.html_url;
  }

  // -------------------------------------------------------------------------
  // Review Comments (inline diff comments)
  // -------------------------------------------------------------------------

  /**
   * Returns all inline review comments on a pull request.
   */
  async listReviewComments(repoPath: string, prNumber: number): Promise<GitHubInlineComment[]> {
    const raw = await this.http.get<GitHubReviewComment[]>(
      `/repos/${repoPath}/pulls/${prNumber}/comments?per_page=100`
    );
    return raw.map((c) => ({
      id: c.id,
      filePath: c.path,
      line: c.line ?? c.start_line ?? 0,
      endLine: c.line ?? 0,
      side: c.side ?? "RIGHT",
      body: c.body,
      commitId: c.commit_id,
      htmlUrl: c.html_url,
      author: c.user.login,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      inReplyToId: c.in_reply_to_id,
    }));
  }

  /**
   * Adds an inline comment on a specific line (or line range) in the diff.
   *
   * @param filePath  - Path of the file being commented on.
   * @param line      - The line number to comment on.
   * @param endLine   - Last line for a multi-line selection. Omit for single-line.
   * @param side      - `"RIGHT"` for additions (new file), `"LEFT"` for deletions (old file).
   *
   * @returns The created comment's HTML URL.
   */
  async addInlineComment(
    repoPath: string,
    prNumber: number,
    body: string,
    filePath: string,
    line: number,
    endLine?: number,
    side: "LEFT" | "RIGHT" = "RIGHT"
  ): Promise<string> {
    const pr = await this.getPullRequest(repoPath, prNumber);

    const payload: Record<string, unknown> = {
      body,
      path: filePath,
      commit_id: pr.head.sha,
      side,
      line,
    };

    if (endLine !== undefined && endLine !== line) {
      payload["start_line"] = line;
      payload["start_side"] = side;
      payload["line"] = endLine;
    }

    const comment = await this.http.post<GitHubReviewComment>(
      `/repos/${repoPath}/pulls/${prNumber}/comments`,
      payload
    );
    return comment.html_url;
  }

  /**
   * Replies to an existing inline review comment thread.
   *
   * @returns The created reply comment's HTML URL.
   */
  async replyToReviewComment(
    repoPath: string,
    prNumber: number,
    commentId: number,
    body: string
  ): Promise<string> {
    const comment = await this.http.post<GitHubReviewComment>(
      `/repos/${repoPath}/pulls/${prNumber}/comments`,
      {
        body,
        in_reply_to: commentId,
      }
    );
    return comment.html_url;
  }

  // -------------------------------------------------------------------------
  // Reviews
  // -------------------------------------------------------------------------

  /**
   * Returns all reviews on a pull request.
   */
  async listReviews(repoPath: string, prNumber: number): Promise<GitHubReview[]> {
    return this.http.get<GitHubReview[]>(
      `/repos/${repoPath}/pulls/${prNumber}/reviews?per_page=100`
    );
  }

  /**
   * Submits a review on a pull request.
   *
   * Use `event: "REQUEST_CHANGES"` to block the PR, `"APPROVE"` to approve,
   * or `"COMMENT"` to leave a non-blocking review.
   *
   * Inline `comments` are attached to specific diff lines in the same request.
   *
   * @returns The submitted review object.
   */
  async submitReview(
    repoPath: string,
    prNumber: number,
    event: ReviewEvent,
    body?: string,
    comments?: ReviewComment[]
  ): Promise<GitHubReview> {
    const mappedComments = comments?.map((c) => {
      const comment: Record<string, unknown> = {
        path: c.path,
        body: c.body,
        line: c.line,
        side: c.side ?? "RIGHT",
      };
      if (c.startLine !== undefined && c.startLine !== c.line) {
        comment["start_line"] = c.startLine;
        comment["start_side"] = c.startSide ?? c.side ?? "RIGHT";
      }
      return comment;
    });

    return this.http.post<GitHubReview>(`/repos/${repoPath}/pulls/${prNumber}/reviews`, {
      event,
      body: body ?? "",
      comments: mappedComments,
    });
  }

  /**
   * Requests changes on a pull request using GitHub's native review API.
   *
   * @param body     - Overall review feedback message.
   * @param comments - Optional inline comments to include in the review.
   *
   * @returns The submitted review object.
   */
  async requestChanges(
    repoPath: string,
    prNumber: number,
    body: string,
    comments?: ReviewComment[]
  ): Promise<GitHubReview> {
    return this.submitReview(repoPath, prNumber, "REQUEST_CHANGES", body, comments);
  }

  /**
   * Approves a pull request.
   *
   * @param body - Optional approval message.
   * @returns The submitted review object.
   */
  async approvePullRequest(
    repoPath: string,
    prNumber: number,
    body?: string
  ): Promise<GitHubReview> {
    return this.submitReview(repoPath, prNumber, "APPROVE", body);
  }

  /**
   * Dismisses an existing review (removes approve/request-changes state).
   *
   * @param reviewId - The ID of the review to dismiss.
   * @param message  - Required dismissal message.
   */
  async dismissReview(
    repoPath: string,
    prNumber: number,
    reviewId: number,
    message: string
  ): Promise<GitHubReview> {
    return this.http.put<GitHubReview>(
      `/repos/${repoPath}/pulls/${prNumber}/reviews/${reviewId}/dismissals`,
      { message, event: "DISMISS" }
    );
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a new GitHubClient for the given API token. */
export function createGitHubClient(token: string): GitHubClient {
  return new GitHubClient(token);
}
