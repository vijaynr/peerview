/**
 * GitLab API response types.
 * Implementation lives in @cr/gitlab; this module re-exports for backward compatibility.
 */
export type {
  GitLabBranch,
  GitLabCommit,
  GitLabCompare,
  GitLabDiscussion,
  GitLabDiscussionNote,
  GitLabInlineComment,
  GitLabMr,
  GitLabMrChangesResponse,
  GitLabMrDetails as GitLabMrWithBasics,
  GitLabNote,
  GitLabNotePosition,
} from "@cr/gitlab";
