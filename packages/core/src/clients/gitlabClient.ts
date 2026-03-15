/**
 * GitLab client interface and factory.
 * Implementation lives in @cr/gitlab; this module re-exports for backward compatibility.
 */
export type {
  GitLabInlineComment,
  GitLabMrDetails,
  GitLabMr,
  GitLabCommit,
  GitLabMrChange,
  GitLabNote,
  GitLabDiscussion,
  MergeRequestState,
  CreateMergeRequestParams,
  UpdateMergeRequestParams,
} from "@cr/gitlab";
export { GitLabClient, createGitLabClient, remoteToProjectPath } from "@cr/gitlab";

// Re-export a legacy-compatible interface alias so existing call-sites that
// type-annotate with `GitLabClient` continue to compile unchanged.
import type { GitLabClient as _GitLabClient } from "@cr/gitlab";
export type { _GitLabClient as GitLabClientInterface };
