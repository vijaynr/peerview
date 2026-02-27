/**
 * GitLab API response types.
 */

export type GitLabBranch = {
  name: string;
};

export type GitLabCompare = {
  diffs?: Array<{ diff?: string }>;
};

export type GitLabMr = {
  iid: number;
  web_url: string;
};

export type GitLabMrWithBasics = {
  iid: number;
  title: string;
  state: string;
  web_url: string;
  description?: string;
  diff_refs?: {
    base_sha?: string;
    start_sha?: string;
    head_sha?: string;
  };
};

export type GitLabCommit = {
  id: string;
  title: string;
  message: string;
};

export type GitLabMrChangesResponse = {
  changes?: Array<{
    old_path?: string;
    new_path?: string;
    diff?: string;
  }>;
};

export type GitLabDiscussion = {
  notes?: Array<{
    id?: number;
    body?: string;
    system?: boolean;
    resolved?: boolean;
    position?: {
      position_type?: string;
      new_path?: string;
      old_path?: string;
      new_line?: number;
      old_line?: number;
      base_sha?: string;
      start_sha?: string;
      head_sha?: string;
    };
  }>;
  resolved?: boolean;
};

export type GitLabInlineComment = {
  filePath: string;
  line: number;
  positionType: "new" | "old";
  body: string;
};
