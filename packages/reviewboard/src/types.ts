/**
 * Review Board API response types.
 */

export type ReviewBoardRepository = {
  id?: number;
  title: string;
  name: string;
  path?: string;
  mirror_path?: string;
};

export type ReviewBoardRequest = {
  id: number;
  summary: string;
  description: string;
  status: string;
  absolute_url: string;
  submitter: {
    username: string;
    title: string;
  };
  repository?: ReviewBoardRepository;
  links: {
    diffs: { href: string };
    reviews: { href: string };
    repository?: { href: string };
  };
};

export type ReviewBoardDiffSet = {
  id: number;
  revision: number;
  links: {
    files: { href: string };
  };
};

export type ReviewBoardFileDiff = {
  id: number;
  source_file: string;
  dest_file: string;
  source_revision: string;
  links: {
    diff_data: { href: string };
  };
};

export type ReviewBoardDiffData = {
  chunks: Array<{
    lines: Array<
      [
        number | null | undefined,
        number | null | undefined,
        string | null | undefined,
        number | null | undefined,
        number | null | undefined,
        string | null | undefined,
      ]
    >;
    change: "equal" | "insert" | "delete" | "replace";
  }>;
};

export type ReviewBoardComment = {
  id: number;
  text: string;
  first_line: number;
  num_lines: number;
  filediff: {
    id: number;
    source_file: string;
    dest_file: string;
  };
};

export type ReviewBoardReview = {
  id: number;
  body_top: string;
  public: boolean;
  links: {
    diff_comments: { href: string };
  };
};

