/**
 * GitLab merge request comment/discussion helpers.
 * Implementation lives in @cr/gitlab (GitLabClient); this module
 * re-exports free-function wrappers for backward compatibility.
 */

import type { GitLabDiscussion, GitLabInlineComment } from "@cr/gitlab";
import { GitLabClient } from "@cr/gitlab";

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
): Promise<import("@cr/gitlab").GitLabDiscussionNote> {
  return client(baseUrl, token).replyToDiscussion(projectPath, mrIid, discussionId, body);
}
