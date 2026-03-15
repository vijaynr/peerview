/**
 * GitLab client interface and factory.
 * Implementation lives in @cr/gitlab; this module re-exports for backward compatibility.
 */
export type {
  CreateMergeRequestParams,
  GitLabCommit,
  GitLabDiscussion,
  GitLabInlineComment,
  GitLabMr,
  GitLabMrChange,
  GitLabMrDetails,
  GitLabNote,
  MergeRequestState,
  UpdateMergeRequestParams,
} from "@cr/gitlab";
export { createGitLabClient, GitLabClient, remoteToProjectPath } from "@cr/gitlab";

// Re-export a legacy-compatible interface alias so existing call-sites that
// type-annotate with `GitLabClient` continue to compile unchanged.
import type { GitLabClient as _GitLabClient } from "@cr/gitlab";

export type { _GitLabClient as GitLabClientInterface };
