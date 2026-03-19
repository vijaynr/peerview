/**
 * GitLab REST API response and domain types.
 */

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export type GitLabBranch = {
  name: string;
  default: boolean;
  protected: boolean;
  merged: boolean;
  commit?: {
    id: string;
    message: string;
    authored_date: string;
  };
};

export type GitLabProject = {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  default_branch: string;
  web_url: string;
  description?: string;
  visibility?: string;
  archived?: boolean;
  last_activity_at?: string;
};

// ---------------------------------------------------------------------------
// Merge Requests
// ---------------------------------------------------------------------------

export type MergeRequestState = "opened" | "closed" | "merged" | "all";

/** Minimal MR representation returned by list/create/update endpoints. */
export type GitLabMr = {
  iid: number;
  web_url: string;
};

/** Full MR representation with title, description, and diff refs. */
export type GitLabMrDetails = {
  iid: number;
  title: string;
  description: string;
  state: MergeRequestState | string;
  web_url: string;
  source_branch: string;
  target_branch: string;
  author?: {
    id: number;
    name: string;
    username: string;
  };
  assignees?: Array<{ id: number; name: string; username: string }>;
  reviewers?: Array<{ id: number; name: string; username: string }>;
  diff_refs?: {
    base_sha: string;
    start_sha: string;
    head_sha: string;
  };
  labels?: string[];
  created_at?: string;
  updated_at?: string;
  merged_at?: string;
};

// ---------------------------------------------------------------------------
// Commits
// ---------------------------------------------------------------------------

export type GitLabCommit = {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name?: string;
  author_email?: string;
  authored_date?: string;
  committed_date?: string;
};

// ---------------------------------------------------------------------------
// Changes / Diff
// ---------------------------------------------------------------------------

export type GitLabMrChange = {
  old_path: string;
  new_path: string;
  /** Raw unified diff string for this file. */
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
};

export type GitLabMrChangesResponse = {
  iid: number;
  changes?: GitLabMrChange[];
};

export type GitLabCompare = {
  diffs?: Array<{ diff?: string; old_path?: string; new_path?: string }>;
  commits?: GitLabCommit[];
  compare_timeout?: boolean;
};

// ---------------------------------------------------------------------------
// Notes (general MR comments)
// ---------------------------------------------------------------------------

export type GitLabNote = {
  id: number;
  body: string;
  author: {
    id: number;
    name: string;
    username: string;
  };
  created_at: string;
  updated_at: string;
  system: boolean;
  resolvable: boolean;
  resolved?: boolean;
  noteable_type: string;
};

// ---------------------------------------------------------------------------
// Discussions (threaded comments, inline comments)
// ---------------------------------------------------------------------------

/** Position of an inline note within a diff. */
export type GitLabNotePosition = {
  position_type: "text" | "image";
  base_sha: string;
  start_sha: string;
  head_sha: string;
  old_path?: string;
  new_path?: string;
  old_line?: number;
  new_line?: number;
  /** Present for multi-line comments. */
  line_range?: {
    start: { line_code: string; type: "new" | "old" };
    end: { line_code: string; type: "new" | "old" };
  };
};

export type GitLabDiscussionNote = {
  id: number;
  body: string;
  author: {
    id: number;
    name: string;
    username: string;
  };
  created_at: string;
  updated_at: string;
  system: boolean;
  resolvable: boolean;
  resolved?: boolean;
  position?: GitLabNotePosition;
};

export type GitLabDiscussion = {
  id: string;
  individual_note: boolean;
  resolved?: boolean;
  notes?: GitLabDiscussionNote[];
};

// ---------------------------------------------------------------------------
// Inline comment (domain type, not a raw API response)
// ---------------------------------------------------------------------------

export type GitLabInlineComment = {
  discussionId: string;
  noteId: number;
  filePath: string;
  /** Start line number. */
  line: number;
  /** End line number for multi-line comments; equal to `line` for single-line. */
  endLine: number;
  positionType: "new" | "old";
  body: string;
  resolved: boolean;
};

// ---------------------------------------------------------------------------
// Create / Update MR input types
// ---------------------------------------------------------------------------

export type CreateMergeRequestParams = {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description?: string;
  /** Assignee user IDs. */
  assigneeIds?: number[];
  /** Reviewer user IDs. */
  reviewerIds?: number[];
  labels?: string[];
  removeSourceBranch?: boolean;
  squash?: boolean;
};

export type UpdateMergeRequestParams = {
  title?: string;
  description?: string;
  labels?: string[];
  assigneeIds?: number[];
  reviewerIds?: number[];
  targetBranch?: string;
  stateEvent?: "close" | "reopen";
};
