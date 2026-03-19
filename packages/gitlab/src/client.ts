import { URL } from "node:url";
import { GitLabApiError, GitLabHttpClient } from "./http-client.js";
import type {
  CreateMergeRequestParams,
  GitLabBranch,
  GitLabCommit,
  GitLabCompare,
  GitLabDiscussion,
  GitLabDiscussionNote,
  GitLabInlineComment,
  GitLabMr,
  GitLabMrChange,
  GitLabMrChangesResponse,
  GitLabMrDetails,
  GitLabNote,
  GitLabProject,
  MergeRequestState,
  UpdateMergeRequestParams,
} from "./types.js";

export type {
  CreateMergeRequestParams,
  GitLabInlineComment,
  MergeRequestState,
  UpdateMergeRequestParams,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function encodeProject(projectPath: string): string {
  return encodeURIComponent(projectPath);
}

/**
 * Converts a git remote URL (SSH or HTTPS) to a GitLab project path.
 * Examples:
 *   git@gitlab.com:owner/repo.git  →  owner/repo
 *   https://gitlab.com/owner/repo  →  owner/repo
 */
export function remoteToProjectPath(remoteUrl: string): string {
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
    // Strip /-/merge_requests/... suffix that may appear in copied MR URLs
    const mrMarker = "/-/merge_requests/";
    if (path.includes(mrMarker)) {
      path = path.split(mrMarker)[0]!;
    }
    return path;
  }

  throw new Error(`Unsupported remote URL: ${remoteUrl}`);
}

// ---------------------------------------------------------------------------
// GitLabClient
// ---------------------------------------------------------------------------

export class GitLabClient {
  private readonly http: GitLabHttpClient;

  constructor(baseUrl: string, token: string) {
    this.http = new GitLabHttpClient(baseUrl, token);
  }

  // -------------------------------------------------------------------------
  // Branches
  // -------------------------------------------------------------------------

  /** Lists all branch names in a project (auto-paginates). */
  async listBranches(projectPath: string): Promise<string[]> {
    const ep = encodeProject(projectPath);
    const branches: string[] = [];
    let page = 1;

    while (true) {
      const result = await this.http.get<GitLabBranch[]>(
        `/api/v4/projects/${ep}/repository/branches?per_page=100&page=${page}`
      );
      if (result.length === 0) break;
      branches.push(...result.map((b) => b.name));
      if (result.length < 100) break;
      page++;
    }

    return branches;
  }

  /** Returns the default branch name for a project. */
  async getDefaultBranch(projectPath: string): Promise<string> {
    const ep = encodeProject(projectPath);
    const project = await this.http.get<GitLabProject>(`/api/v4/projects/${ep}`);
    return project.default_branch;
  }

  /** Returns true if the named branch exists. */
  async branchExists(projectPath: string, branchName: string): Promise<boolean> {
    const ep = encodeProject(projectPath);
    const eb = encodeURIComponent(branchName);
    try {
      await this.http.get<GitLabBranch>(`/api/v4/projects/${ep}/repository/branches/${eb}`, {
        silent: true,
      });
      return true;
    } catch (err) {
      if (err instanceof GitLabApiError && err.status === 404) return false;
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Repository
  // -------------------------------------------------------------------------

  /**
   * Lists projects the authenticated user can actively work in.
   * Uses membership scope to avoid flooding the picker with unrelated public projects.
   */
  async listProjects(): Promise<GitLabProject[]> {
    const projects: GitLabProject[] = [];
    let page = 1;

    while (true) {
      const result = await this.http.get<GitLabProject[]>(
        `/api/v4/projects?membership=true&simple=true&archived=false&order_by=last_activity_at&sort=desc&per_page=100&page=${page}`
      );

      if (result.length === 0) {
        break;
      }

      projects.push(...result);

      if (result.length < 100) {
        break;
      }

      page += 1;
    }

    return projects;
  }

  /**
   * Fetches the raw content of a file at a specific ref.
   * Returns null if the file does not exist (404).
   */
  async getFileRaw(projectPath: string, filePath: string, ref: string): Promise<string | null> {
    const ep = encodeProject(projectPath);
    const encodedPath = encodeURIComponent(filePath);
    return this.http.requestText(
      `/api/v4/projects/${ep}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(ref)}`
    );
  }

  /**
   * Compares two branches and returns the unified diff text.
   * Falls back to a commit summary when the diff is too large.
   */
  async compareBranches(
    projectPath: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<string> {
    const ep = encodeProject(projectPath);
    const compare = await this.http.get<GitLabCompare>(
      `/api/v4/projects/${ep}/repository/compare?from=${encodeURIComponent(targetBranch)}&to=${encodeURIComponent(sourceBranch)}`
    );

    const diffs = compare.diffs ?? [];
    const diffText = diffs
      .map((d) => d.diff ?? "")
      .join("\n")
      .trim();

    if (diffText) return diffText;

    // GitLab truncates diffs on large changesets — fall back to commit messages
    const commits = compare.commits ?? [];
    if (commits.length > 0) {
      const lines = commits
        .map((c) => `- ${c.id.slice(0, 8)} ${c.title ?? c.message ?? ""}`.trim())
        .join("\n");
      return `## Commits (diff unavailable — changeset too large)\n\n${lines}`;
    }

    return "";
  }

  // -------------------------------------------------------------------------
  // Merge Requests — Read
  // -------------------------------------------------------------------------

  /**
   * Lists merge requests in a project filtered by state.
   */
  async listMergeRequests(
    projectPath: string,
    state: MergeRequestState = "opened"
  ): Promise<GitLabMrDetails[]> {
    const ep = encodeProject(projectPath);
    return this.http.get<GitLabMrDetails[]>(
      `/api/v4/projects/${ep}/merge_requests?state=${encodeURIComponent(state)}&per_page=100`
    );
  }

  /**
   * Finds the first open MR whose source branch matches.
   */
  async findOpenMergeRequestBySourceBranch(
    projectPath: string,
    sourceBranch: string
  ): Promise<GitLabMrDetails | null> {
    const ep = encodeProject(projectPath);
    const mrs = await this.http.get<GitLabMrDetails[]>(
      `/api/v4/projects/${ep}/merge_requests?state=opened&source_branch=${encodeURIComponent(sourceBranch)}&per_page=1`
    );
    return mrs[0] ?? null;
  }

  /**
   * Finds an open MR matching both source and target branches exactly.
   */
  async findExistingMergeRequest(
    projectPath: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<GitLabMr | null> {
    const ep = encodeProject(projectPath);
    const mrs = await this.http.get<GitLabMr[]>(
      `/api/v4/projects/${ep}/merge_requests?state=opened&source_branch=${encodeURIComponent(sourceBranch)}&target_branch=${encodeURIComponent(targetBranch)}&per_page=1`
    );
    return mrs[0] ?? null;
  }

  /**
   * Returns the full details of a single merge request by its IID.
   * The returned object includes title, description, state, diff_refs, etc.
   */
  async getMergeRequest(projectPath: string, mrIid: number): Promise<GitLabMrDetails> {
    const ep = encodeProject(projectPath);
    return this.http.get<GitLabMrDetails>(`/api/v4/projects/${ep}/merge_requests/${mrIid}`);
  }

  /**
   * Returns the file-level diff changes for a merge request.
   */
  async getMergeRequestDiff(projectPath: string, mrIid: number): Promise<GitLabMrChange[]> {
    const ep = encodeProject(projectPath);
    const response = await this.http.get<GitLabMrChangesResponse>(
      `/api/v4/projects/${ep}/merge_requests/${mrIid}/changes`
    );
    return response.changes ?? [];
  }

  /**
   * Returns all commits included in a merge request (up to 100).
   */
  async getMergeRequestCommits(projectPath: string, mrIid: number): Promise<GitLabCommit[]> {
    const ep = encodeProject(projectPath);
    return this.http.get<GitLabCommit[]>(
      `/api/v4/projects/${ep}/merge_requests/${mrIid}/commits?per_page=100`
    );
  }

  // -------------------------------------------------------------------------
  // Merge Requests — Create / Update
  // -------------------------------------------------------------------------

  /**
   * Creates a new merge request and returns its web URL.
   */
  async createMergeRequest(
    projectPath: string,
    params: CreateMergeRequestParams
  ): Promise<GitLabMrDetails> {
    const ep = encodeProject(projectPath);
    return this.http.post<GitLabMrDetails>(`/api/v4/projects/${ep}/merge_requests`, {
      source_branch: params.sourceBranch,
      target_branch: params.targetBranch,
      title: params.title,
      description: params.description ?? "",
      assignee_ids: params.assigneeIds,
      reviewer_ids: params.reviewerIds,
      labels: params.labels?.join(","),
      remove_source_branch: params.removeSourceBranch,
      squash: params.squash,
    });
  }

  /**
   * Updates fields on an existing merge request.
   */
  async updateMergeRequest(
    projectPath: string,
    mrIid: number,
    params: UpdateMergeRequestParams
  ): Promise<GitLabMrDetails> {
    const ep = encodeProject(projectPath);
    return this.http.put<GitLabMrDetails>(`/api/v4/projects/${ep}/merge_requests/${mrIid}`, {
      title: params.title,
      description: params.description,
      labels: params.labels?.join(","),
      assignee_ids: params.assigneeIds,
      reviewer_ids: params.reviewerIds,
      target_branch: params.targetBranch,
      state_event: params.stateEvent,
    });
  }

  /**
   * Updates only the description of a merge request.
   */
  async updateMergeRequestDescription(
    projectPath: string,
    mrIid: number,
    description: string
  ): Promise<GitLabMrDetails> {
    return this.updateMergeRequest(projectPath, mrIid, { description });
  }

  // -------------------------------------------------------------------------
  // Notes (general MR comments)
  // -------------------------------------------------------------------------

  /**
   * Returns all non-system notes (comments) on a merge request.
   * This includes general comments but not inline diff comments.
   */
  async listMergeRequestNotes(projectPath: string, mrIid: number): Promise<GitLabNote[]> {
    const ep = encodeProject(projectPath);
    const notes = await this.http.get<GitLabNote[]>(
      `/api/v4/projects/${ep}/merge_requests/${mrIid}/notes?per_page=100`
    );
    return notes.filter((n) => !n.system);
  }

  /**
   * Posts a top-level comment (note) on the merge request.
   * Returns the created note ID as a string.
   */
  async addMergeRequestComment(projectPath: string, mrIid: number, body: string): Promise<string> {
    const ep = encodeProject(projectPath);
    const note = await this.http.post<GitLabNote>(
      `/api/v4/projects/${ep}/merge_requests/${mrIid}/notes`,
      { body }
    );
    return `note_${note.id}`;
  }

  /**
   * Posts a "Changes Requested" review comment on the merge request.
   *
   * GitLab does not have a universal "request changes" API that works across
   * all tiers and versions. This method adds a structured note that clearly
   * signals a change request, prefixed with a standardized header so it can
   * be identified programmatically.
   *
   * @param comment - Optional explanation to include with the change request.
   * @returns The created note ID as a string.
   */
  async requestChanges(projectPath: string, mrIid: number, comment?: string): Promise<string> {
    const body = [
      "## 🔴 Changes Requested",
      "",
      comment ?? "This merge request requires changes before it can be merged.",
    ].join("\n");
    return this.addMergeRequestComment(projectPath, mrIid, body);
  }

  // -------------------------------------------------------------------------
  // Discussions (threaded/inline comments)
  // -------------------------------------------------------------------------

  /**
   * Returns all discussions on a merge request, including inline diff threads.
   */
  async listDiscussions(projectPath: string, mrIid: number): Promise<GitLabDiscussion[]> {
    const ep = encodeProject(projectPath);
    return this.http.get<GitLabDiscussion[]>(
      `/api/v4/projects/${ep}/merge_requests/${mrIid}/discussions?per_page=100`
    );
  }

  /**
   * Returns all unresolved inline diff comments on a merge request.
   * Comments that belong to outdated diff versions are filtered out.
   */
  async listInlineComments(projectPath: string, mrIid: number): Promise<GitLabInlineComment[]> {
    const [discussions, mr] = await Promise.all([
      this.listDiscussions(projectPath, mrIid),
      this.getMergeRequest(projectPath, mrIid),
    ]);

    const {
      base_sha: currentBase,
      start_sha: currentStart,
      head_sha: currentHead,
    } = mr.diff_refs ?? {};

    const result: GitLabInlineComment[] = [];

    for (const discussion of discussions) {
      if (discussion.resolved === true) continue;

      for (const note of discussion.notes ?? []) {
        if (note.system || note.resolved) continue;

        const pos = note.position;
        if (!pos || pos.position_type !== "text") continue;

        // Skip notes that belong to an outdated diff
        if (currentHead && pos.head_sha && pos.head_sha !== currentHead) continue;
        if (currentStart && pos.start_sha && pos.start_sha !== currentStart) continue;
        if (currentBase && pos.base_sha && pos.base_sha !== currentBase) continue;

        const filePath = pos.new_path ?? pos.old_path;
        const line = pos.new_line ?? pos.old_line;
        if (!filePath || !line) continue;

        const endLine = pos.line_range?.end ? (pos.new_line ?? pos.old_line ?? line) : line;

        result.push({
          discussionId: discussion.id,
          noteId: note.id,
          filePath,
          line,
          endLine,
          positionType: pos.new_line !== undefined ? "new" : "old",
          body: note.body.trim(),
          resolved: note.resolved ?? false,
        });
      }
    }

    return result;
  }

  /**
   * Adds an inline comment to a specific line (or line range) in a diff.
   *
   * @param filePath - Path of the file being commented on (relative to repo root).
   * @param line     - The line number to comment on (in the new or old version).
   * @param endLine  - Last line of a multi-line selection. Omit for single-line.
   * @param positionType - Whether `line` refers to the new (`"new"`) or old (`"old"`) file version.
   *
   * @returns The created discussion/note ID.
   */
  async addInlineComment(
    projectPath: string,
    mrIid: number,
    body: string,
    filePath: string,
    line: number,
    endLine?: number,
    positionType: "new" | "old" = "new"
  ): Promise<string> {
    const ep = encodeProject(projectPath);
    const mr = await this.getMergeRequest(projectPath, mrIid);
    const diffRefs = mr.diff_refs;

    if (!diffRefs?.base_sha || !diffRefs.start_sha || !diffRefs.head_sha) {
      throw new Error("Merge request diff refs are missing; cannot create inline comment.");
    }

    const position: Record<string, unknown> = {
      position_type: "text",
      base_sha: diffRefs.base_sha,
      start_sha: diffRefs.start_sha,
      head_sha: diffRefs.head_sha,
    };

    if (positionType === "old") {
      position["old_path"] = filePath;
      position["old_line"] = line;
    } else {
      position["new_path"] = filePath;
      position["new_line"] = line;
    }

    // Multi-line comment: attach a line_range to the position
    if (endLine !== undefined && endLine !== line) {
      // GitLab requires line_code which is SHA1(filePath + lineType + lineNumber)
      // but for the API we can use the simplified form with line numbers directly
      position["line_range"] = {
        start: {
          line_code: this.buildLineCode(filePath, line, positionType),
          type: positionType,
        },
        end: {
          line_code: this.buildLineCode(filePath, endLine, positionType),
          type: positionType,
        },
      };
    }

    try {
      const discussion = await this.http.post<GitLabDiscussion>(
        `/api/v4/projects/${ep}/merge_requests/${mrIid}/discussions`,
        { body, position }
      );
      const noteId = discussion.notes?.[0]?.id;
      return noteId !== undefined ? `note_${noteId}` : `discussion_${discussion.id}`;
    } catch {
      // Fall back to a plain note if the inline position is rejected
      const note = await this.http.post<{ id: number }>(
        `/api/v4/projects/${ep}/merge_requests/${mrIid}/notes`,
        { body, position }
      );
      return `note_${note.id}`;
    }
  }

  /**
   * Resolves an existing discussion thread on a merge request.
   */
  async resolveDiscussion(projectPath: string, mrIid: number, discussionId: string): Promise<void> {
    const ep = encodeProject(projectPath);
    await this.http.put<GitLabDiscussion>(
      `/api/v4/projects/${ep}/merge_requests/${mrIid}/discussions/${encodeURIComponent(discussionId)}`,
      { resolved: true }
    );
  }

  /**
   * Replies to an existing discussion thread.
   */
  async replyToDiscussion(
    projectPath: string,
    mrIid: number,
    discussionId: string,
    body: string
  ): Promise<GitLabDiscussionNote> {
    const ep = encodeProject(projectPath);
    return this.http.post<GitLabDiscussionNote>(
      `/api/v4/projects/${ep}/merge_requests/${mrIid}/discussions/${encodeURIComponent(discussionId)}/notes`,
      { body }
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Builds a GitLab line_code string used for multi-line comment positions.
   * Format: `{sha}_{old_line}_{new_line}` — we approximate using the file path
   * hash since the full SHA-based code requires the diff context.
   */
  private buildLineCode(filePath: string, lineNumber: number, type: "new" | "old"): string {
    // GitLab's canonical line_code is computed as:
    //   SHA1(filePath) + "_" + oldLine + "_" + newLine
    // We emit a simplified form here; GitLab also accepts positional objects
    // in newer API versions.
    const oldLine = type === "old" ? lineNumber : 0;
    const newLine = type === "new" ? lineNumber : 0;
    return `${filePath.replace(/\//g, "_")}_${oldLine}_${newLine}`;
  }

  // -------------------------------------------------------------------------
  // Backward-compatible aliases
  // -------------------------------------------------------------------------

  /** @deprecated Use getMergeRequestDiff instead */
  getMergeRequestChanges(projectPath: string, mrIid: number): Promise<GitLabMrChange[]> {
    return this.getMergeRequestDiff(projectPath, mrIid);
  }

  /** @deprecated Use listInlineComments instead */
  getMergeRequestInlineComments(
    projectPath: string,
    mrIid: number
  ): Promise<GitLabInlineComment[]> {
    return this.listInlineComments(projectPath, mrIid);
  }

  /** @deprecated Use addInlineComment instead */
  addInlineMergeRequestComment(
    projectPath: string,
    mrIid: number,
    body: string,
    filePath: string,
    line: number,
    positionType: "new" | "old" = "new"
  ): Promise<string> {
    return this.addInlineComment(projectPath, mrIid, body, filePath, line, undefined, positionType);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a new GitLabClient for the given instance URL and API token. */
export function createGitLabClient(baseUrl: string, token: string): GitLabClient {
  return new GitLabClient(baseUrl, token);
}
