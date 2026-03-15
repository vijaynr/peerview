/**
 * GitHub API response types.
 */

export type GitHubBranch = {
  name: string;
};

export type GitHubCompare = {
  files?: Array<{
    filename?: string;
    previous_filename?: string;
    patch?: string;
    status?: string;
  }>;
  commits?: Array<{ 
    sha: string; 
    commit: { 
      message: string;
    };
  }>;
};

export type GitHubPr = {
  number: number;
  html_url: string;
};

export type GitHubPrWithBasics = {
  number: number;
  title: string;
  state: string;
  html_url: string;
  body?: string;
  head?: {
    sha?: string;
    ref?: string;
  };
  base?: {
    sha?: string;
    ref?: string;
  };
};

export type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
  };
};

export type GitHubPrFilesResponse = {
  filename: string;
  previous_filename?: string;
  patch?: string;
  status: string;
};

export type GitHubPrReviewComment = {
  id?: number;
  body?: string;
  position?: number;
  line?: number;
  side?: "LEFT" | "RIGHT";
  path?: string;
  commit_id?: string;
  original_commit_id?: string;
  diff_hunk?: string;
};

export type GitHubInlineComment = {
  filePath: string;
  line: number;
  side: "LEFT" | "RIGHT";
  body: string;
};

export type GitHubRepository = {
  full_name: string;
  default_branch: string;
};