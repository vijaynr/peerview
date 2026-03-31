/**
 * GitLab merge request comment/discussion helpers.
 * Implementation lives in @pv/gitlab (GitLabClient); this module
 * re-exports free-function wrappers for backward compatibility.
 */

import type { GitLabDiscussion, GitLabInlineComment } from "@pv/vcs/gitlab";
import { GitLabClient } from "@pv/vcs/gitlab";

export type { GitLabDiscussion, GitLabInlineComment };

function client(baseUrl: string, token: string): GitLabClient {
  return new GitLabClient(baseUrl, token);
}

export function addMergeRequestComment(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number,
  body: string
): Promise<string> {
  return client(baseUrl, token).addMergeRequestComment(projectPath, mrIid, body);
}

export function getMergeRequestInlineComments(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<GitLabInlineComment[]> {
  return client(baseUrl, token).listInlineComments(projectPath, mrIid);
}

export function listMergeRequestDiscussions(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<GitLabDiscussion[]> {
  return client(baseUrl, token).listDiscussions(projectPath, mrIid);
}

export function addInlineMergeRequestComment(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number,
  body: string,
  filePath: string,
  line: number,
  positionType: "new" | "old" = "new"
): Promise<string> {
  return client(baseUrl, token).addInlineComment(
    projectPath,
    mrIid,
    body,
    filePath,
    line,
    undefined,
    positionType
  );
}

export function replyToMergeRequestDiscussion(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number,
  discussionId: string,
  body: string
): Promise<import("@pv/vcs/gitlab").GitLabDiscussionNote> {
  return client(baseUrl, token).replyToDiscussion(projectPath, mrIid, discussionId, body);
}

export function updateMergeRequestDiscussionNote(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number,
  discussionId: string,
  noteId: number,
  body: string
): Promise<import("@pv/vcs/gitlab").GitLabDiscussionNote> {
  return client(baseUrl, token).updateDiscussionNote(
    projectPath,
    mrIid,
    discussionId,
    noteId,
    body
  );
}

export function deleteMergeRequestDiscussionNote(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number,
  discussionId: string,
  noteId: number
): Promise<void> {
  return client(baseUrl, token).deleteDiscussionNote(
    projectPath,
    mrIid,
    discussionId,
    noteId
  );
}
