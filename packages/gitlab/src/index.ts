export { GitLabClient, createGitLabClient, remoteToProjectPath } from "./client.js";
export { GitLabHttpClient, GitLabApiError } from "./http-client.js";
export type { RequestOptions } from "./http-client.js";
export type {
  // Branches / repo
  GitLabBranch,
  GitLabProject,
  // Merge requests
  MergeRequestState,
  GitLabMr,
  GitLabMrDetails,
  CreateMergeRequestParams,
  UpdateMergeRequestParams,
  // Commits
  GitLabCommit,
  // Diff
  GitLabMrChange,
  GitLabMrChangesResponse,
  GitLabCompare,
  // Notes / discussions
  GitLabNote,
  GitLabNotePosition,
  GitLabDiscussionNote,
  GitLabDiscussion,
  GitLabInlineComment,
} from "./types.js";
