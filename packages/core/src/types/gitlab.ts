/**
 * GitLab API response types.
 * Implementation lives in @cr/gitlab; this module re-exports for backward compatibility.
 */
export type {
  GitLabBranch,
  GitLabCompare,
  GitLabMr,
  GitLabMrDetails as GitLabMrWithBasics,
  GitLabCommit,
  GitLabMrChangesResponse,
  GitLabDiscussion,
  GitLabInlineComment,
  GitLabNote,
  GitLabNotePosition,
  GitLabDiscussionNote,
} from "@cr/gitlab";
