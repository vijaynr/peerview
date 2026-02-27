import { URL } from "node:url";
import type {
  GitLabBranch,
  GitLabCompare,
  GitLabMr,
  GitLabMrWithBasics,
  GitLabCommit,
  GitLabMrChangesResponse,
  GitLabDiscussion,
  GitLabInlineComment,
} from "../types/gitlab.js";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Converts a git remote URL to a GitLab project path.
 * Supports both SSH (git@gitlab.com:...) and HTTPS URLs.
 */
function remoteToProjectPath(remoteUrl: string): string {
  const sanitized = remoteUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");

  if (sanitized.startsWith("git@")) {
    const parts = sanitized.split(":", 2);
    if (parts.length < 2 || !parts[1]) {
      throw new Error(`Unsupported SSH remote URL: ${remoteUrl}`);
    }
    return parts[1];
  }

  if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
    const parsed = new URL(sanitized);
    const path = parsed.pathname.replace(/^\/+/, "");
    if (!path) {
      throw new Error(`Unsupported HTTP remote URL: ${remoteUrl}`);
    }
    return path;
  }

  throw new Error(`Unsupported remote URL: ${remoteUrl}`);
}

async function gitlabRequest<T>(
  baseUrl: string,
  token: string,
  endpoint: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${endpoint}`, {
    ...init,
    headers: {
      "PRIVATE-TOKEN": token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitLab API ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

/**
 * Fetches a list of all branches in a GitLab project.
 * @param baseUrl GitLab instance URL
 * @param token GitLab API access token
 * @param projectPath Project path (e.g., "owner/repo")
 */
export async function listBranches(
  baseUrl: string,
  token: string,
  projectPath: string
): Promise<string[]> {
  const encodedProject = encodeURIComponent(projectPath);
  const result = await gitlabRequest<GitLabBranch[]>(
    baseUrl,
    token,
    `/api/v4/projects/${encodedProject}/repository/branches?per_page=100`
  );
  return result.map((b) => b.name);
}

/**
 * Lists merge requests in a GitLab project by state.
 * @param baseUrl GitLab instance URL
 * @param token GitLab API access token
 * @param projectPath Project path (e.g., "owner/repo")
 * @param state Filter by MR state: "opened", "closed", "merged", or "all"
 */
export async function listMergeRequests(
  baseUrl: string,
  token: string,
  projectPath: string,
  state: "opened" | "closed" | "merged" | "all"
): Promise<GitLabMrWithBasics[]> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests?state=${encodeURIComponent(state)}&per_page=100`;
  return gitlabRequest<GitLabMrWithBasics[]>(baseUrl, token, endpoint);
}

export async function findOpenMergeRequestBySourceBranch(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string
): Promise<GitLabMrWithBasics | null> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests?state=opened&source_branch=${encodeURIComponent(sourceBranch)}&per_page=1`;
  const mrs = await gitlabRequest<GitLabMrWithBasics[]>(baseUrl, token, endpoint);
  return mrs[0] ?? null;
}

export async function getMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<GitLabMrWithBasics> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}`;
  return gitlabRequest<GitLabMrWithBasics>(baseUrl, token, endpoint);
}

export async function getMergeRequestChanges(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<Array<{ old_path?: string; new_path?: string; diff?: string }>> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/changes`;
  const response = await gitlabRequest<GitLabMrChangesResponse>(baseUrl, token, endpoint);
  return response.changes ?? [];
}

export async function getMergeRequestCommits(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<GitLabCommit[]> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/commits?per_page=100`;
  return gitlabRequest<GitLabCommit[]>(baseUrl, token, endpoint);
}

export async function addMergeRequestComment(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number,
  body: string
): Promise<string> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/notes`;
  const response = await gitlabRequest<{ id: number; body: string }>(baseUrl, token, endpoint, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return `note_${response.id}`;
}

export async function getMergeRequestInlineComments(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number
): Promise<GitLabInlineComment[]> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/discussions?per_page=100`;
  const discussions = await gitlabRequest<GitLabDiscussion[]>(baseUrl, token, endpoint);
  const mr = await getMergeRequest(baseUrl, token, projectPath, mrIid);
  const currentBase = mr.diff_refs?.base_sha;
  const currentStart = mr.diff_refs?.start_sha;
  const currentHead = mr.diff_refs?.head_sha;

  const inlineComments: GitLabInlineComment[] = [];

  for (const discussion of discussions) {
    if (discussion.resolved === true) {
      continue;
    }
    const notes = discussion.notes ?? [];
    for (const note of notes) {
      if (note.system === true || note.resolved === true) {
        continue;
      }

      const position = note.position;
      if (!position || position.position_type !== "text") {
        continue;
      }

      if (currentHead && position.head_sha && position.head_sha !== currentHead) {
        continue;
      }
      if (currentStart && position.start_sha && position.start_sha !== currentStart) {
        continue;
      }
      if (currentBase && position.base_sha && position.base_sha !== currentBase) {
        continue;
      }

      const filePath = position.new_path ?? position.old_path;
      const line = position.new_line ?? position.old_line;
      if (!filePath || !line) {
        continue;
      }

      inlineComments.push({
        filePath,
        line,
        positionType: position.new_line ? "new" : "old",
        body: (note.body ?? "").trim(),
      });
    }
  }

  return inlineComments;
}

export async function addInlineMergeRequestComment(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number,
  body: string,
  filePath: string,
  line: number,
  positionType: "new" | "old" = "new"
): Promise<string> {
  const encodedProject = encodeURIComponent(projectPath);
  const mr = await getMergeRequest(baseUrl, token, projectPath, mrIid);
  const diffRefs = mr.diff_refs;

  if (!diffRefs?.base_sha || !diffRefs.start_sha || !diffRefs.head_sha) {
    throw new Error("Merge request diff refs are missing; cannot create inline comment.");
  }

  const position: Record<string, string | number> = {
    position_type: "text",
    base_sha: diffRefs.base_sha,
    start_sha: diffRefs.start_sha,
    head_sha: diffRefs.head_sha,
  };

  if (positionType === "old") {
    position.old_path = filePath;
    position.old_line = line;
  } else {
    position.new_path = filePath;
    position.new_line = line;
  }

  try {
    const discussionEndpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/discussions`;
    const discussion = await gitlabRequest<GitLabDiscussion>(baseUrl, token, discussionEndpoint, {
      method: "POST",
      body: JSON.stringify({ body, position }),
    });

    const noteId = discussion.notes?.[0]?.id;
    return noteId ? `note_${noteId}` : "discussion_created";
  } catch {
    const noteEndpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/notes`;
    const note = await gitlabRequest<{ id: number }>(baseUrl, token, noteEndpoint, {
      method: "POST",
      body: JSON.stringify({ body, position }),
    });
    return `note_${note.id}`;
  }
}

export async function compareBranches(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string,
  targetBranch: string
): Promise<string> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/repository/compare?from=${encodeURIComponent(targetBranch)}&to=${encodeURIComponent(sourceBranch)}`;
  const compare = await gitlabRequest<GitLabCompare>(baseUrl, token, endpoint);
  const diffs = compare.diffs ?? [];
  return diffs.map((d) => d.diff ?? "").join("\n");
}

export async function findExistingMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string,
  targetBranch: string
): Promise<GitLabMr | null> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests?state=opened&source_branch=${encodeURIComponent(sourceBranch)}&target_branch=${encodeURIComponent(targetBranch)}&per_page=1`;
  const mrs = await gitlabRequest<GitLabMr[]>(baseUrl, token, endpoint);
  return mrs[0] ?? null;
}

export async function createMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  sourceBranch: string,
  targetBranch: string,
  title: string,
  description: string
): Promise<string> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests`;
  const mr = await gitlabRequest<GitLabMr>(baseUrl, token, endpoint, {
    method: "POST",
    body: JSON.stringify({
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title,
      description,
    }),
  });
  return mr.web_url;
}

export async function updateMergeRequest(
  baseUrl: string,
  token: string,
  projectPath: string,
  mrIid: number,
  title: string,
  description: string
): Promise<string> {
  const encodedProject = encodeURIComponent(projectPath);
  const endpoint = `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}`;
  const mr = await gitlabRequest<GitLabMr>(baseUrl, token, endpoint, {
    method: "PUT",
    body: JSON.stringify({ title, description }),
  });
  return mr.web_url;
}

export { remoteToProjectPath };
export type { GitLabInlineComment };
