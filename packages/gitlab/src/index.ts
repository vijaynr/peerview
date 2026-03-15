export { createGitLabClient, GitLabClient, remoteToProjectPath } from "./client.js";
export type { RequestOptions } from "./http-client.js";
export { GitLabApiError, GitLabHttpClient } from "./http-client.js";
export type {
  CreateMergeRequestParams,
  // Branches / repo
  GitLabBranch,
  // Commits
  GitLabCommit,
  GitLabCompare,
  GitLabDiscussion,
  GitLabDiscussionNote,
  GitLabInlineComment,
  GitLabMr,
  // Diff
  GitLabMrChange,
  GitLabMrChangesResponse,
  GitLabMrDetails,
  // Notes / discussions
  GitLabNote,
  GitLabNotePosition,
  GitLabProject,
  // Merge requests
  MergeRequestState,
  UpdateMergeRequestParams,
} from "./types.js";
