/**
 * GitHub REST API response and domain types.
 */

// ---------------------------------------------------------------------------
// Branches / Repository
// ---------------------------------------------------------------------------

export type GitHubBranch = {
  name: string;
  protected: boolean;
  commit?: {
    sha: string;
    url: string;
  };
};

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  html_url: string;
  private: boolean;
  description?: string;
  visibility?: string;
  updated_at?: string;
  owner?: {
    login: string;
  };
};

// ---------------------------------------------------------------------------
// Pull Requests
// ---------------------------------------------------------------------------

export type PullRequestState = "open" | "closed" | "all";

/** Minimal PR representation returned by list endpoints. */
export type GitHubPr = {
  number: number;
  html_url: string;
};

/** Full PR representation with head/base refs. */
export type GitHubPrDetails = {
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  draft: boolean;
  head: {
    sha: string;
    ref: string;
    label: string;
  };
  base: {
    sha: string;
    ref: string;
    label: string;
  };
  user?: {
    login: string;
    id: number;
  };
  assignees?: Array<{ login: string; id: number }>;
  requested_reviewers?: Array<{ login: string; id: number }>;
  labels?: Array<{ name: string; color: string }>;
  created_at?: string;
  updated_at?: string;
  merged_at?: string;
  merged?: boolean;
};

// ---------------------------------------------------------------------------
// Commits
// ---------------------------------------------------------------------------

export type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author?: {
      name: string;
      email: string;
      date: string;
    };
  };
  author?: {
    login: string;
  };
};

// ---------------------------------------------------------------------------
// Files / Diff
// ---------------------------------------------------------------------------

export type GitHubPrFile = {
  filename: string;
  previous_filename?: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
};

export type GitHubCompare = {
  files?: GitHubPrFile[];
  commits?: GitHubCommit[];
  ahead_by?: number;
  behind_by?: number;
};

export type GitHubFileContent = {
  name: string;
  path: string;
  sha: string;
  content: string;
  encoding: string;
};

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/** A general issue/PR comment (not a review comment). */
export type GitHubIssueComment = {
  id: number;
  body: string;
  html_url: string;
  user: {
    login: string;
    id: number;
  };
  created_at: string;
  updated_at: string;
};

/** An inline review comment on a specific diff line. */
export type GitHubReviewComment = {
  id: number;
  body: string;
  html_url: string;
  path: string;
  /** Line number in the diff. */
  line?: number;
  /** Starting line for multi-line comments. */
  start_line?: number;
  side?: "LEFT" | "RIGHT";
  start_side?: "LEFT" | "RIGHT";
  commit_id: string;
  original_commit_id?: string;
  diff_hunk?: string;
  user: {
    login: string;
    id: number;
  };
  created_at: string;
  updated_at: string;
  /** ID of the review this comment belongs to, if any. */
  pull_request_review_id?: number;
  /** Present when this comment is a reply to another review comment. */
  in_reply_to_id?: number;
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT" | "PENDING";

export type GitHubReview = {
  id: number;
  user: {
    login: string;
    id: number;
  };
  body: string;
  state: ReviewEvent | string;
  html_url: string;
  submitted_at?: string;
  commit_id: string;
};

// ---------------------------------------------------------------------------
// Inline comment (domain type, not a raw API response)
// ---------------------------------------------------------------------------

export type GitHubInlineComment = {
  id: number;
  filePath: string;
  /** Start line of the comment (or the only line for single-line). */
  line: number;
  /** End line for multi-line comments; equal to `line` for single-line. */
  endLine: number;
  side: "LEFT" | "RIGHT";
  body: string;
  commitId: string;
  htmlUrl?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  inReplyToId?: number;
};

// ---------------------------------------------------------------------------
// Create / Update PR input types
// ---------------------------------------------------------------------------

export type CreatePullRequestParams = {
  headBranch: string;
  baseBranch: string;
  title: string;
  body?: string;
  draft?: boolean;
  maintainerCanModify?: boolean;
};

export type UpdatePullRequestParams = {
  title?: string;
  body?: string;
  state?: "open" | "closed";
  base?: string;
};

/** A single inline comment included in a review submission. */
export type ReviewComment = {
  path: string;
  line: number;
  /** Start line for multi-line comments. */
  startLine?: number;
  side?: "LEFT" | "RIGHT";
  startSide?: "LEFT" | "RIGHT";
  body: string;
};
