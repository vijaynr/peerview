import type {
  CRConfigRecord,
  DashboardData,
  ProviderRepositoryOption,
  ProviderId,
  RepositoryContext,
  ReviewAgentOption,
  ReviewChatContext,
  ReviewChatHistoryEntry,
  ReviewCommit,
  ReviewDiscussionThread,
  ReviewDiffFile,
  ReviewPostResponse,
  ReviewRunResponse,
  ReviewState,
  ReviewSummaryResponse,
  ReviewTarget,
  ReviewWorkflowResult,
} from "./types.js";
import { isDesktop, desktopFetch, initBridge } from "./desktop-bridge.js";

type JsonObject = Record<string, unknown>;

// Initialise the desktop RPC bridge once (no-op if not in desktop mode)
if (isDesktop()) {
  initBridge().catch((err) =>
    console.error("[api] Failed to initialise desktop bridge:", err),
  );
}

/**
 * Transport-aware fetch wrapper.
 * In desktop mode routes through Electrobun RPC; otherwise uses standard HTTP.
 */
async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const doFetch = isDesktop() ? desktopFetch : fetch;
  const response = await doFetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const json = (await response.json().catch(() => null)) as
    | { message?: string; status?: string }
    | T
    | null;

  if (!response.ok) {
    const message =
      json && typeof json === "object" && "message" in json && typeof json.message === "string"
        ? json.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}

function asRecord(value: unknown): JsonObject {
  return typeof value === "object" && value !== null ? (value as JsonObject) : {};
}

function stringValue(record: JsonObject, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function isMaskedDisplayValue(value: string): boolean {
  return /^[*\s]+$/.test(value.trim());
}

function identityValue(record: JsonObject, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }
    if (!isMaskedDisplayValue(value)) {
      return value;
    }
  }

  return undefined;
}

function numberValue(record: JsonObject, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function booleanValue(record: JsonObject, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function nestedStringValue(record: JsonObject, key: string, nestedKey: string): string | undefined {
  const nested = asRecord(record[key]);
  const value = nested[nestedKey];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeUpdatedAt(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function normalizeReviewTarget(provider: ProviderId, item: unknown): ReviewTarget {
  const record = asRecord(item);
  const id =
    numberValue(record, "iid", "number", "id", "review_request_id") ??
    Number(stringValue(record, "iid", "number", "id") ?? "0");

  const authorRecord = asRecord(record.author);
  const submitterRecord = asRecord(record.submitter);
  const linksRecord = asRecord(record.links);
  const description =
    stringValue(record, "description", "body", "body_html") ??
    nestedStringValue(record, "description", "text");

  return {
    provider,
    id,
    title:
      stringValue(record, "title", "summary", "name") ??
      `${provider === "gitlab" ? "MR" : provider === "github" ? "PR" : "RR"} ${id}`,
    url:
      stringValue(record, "web_url", "html_url", "absolute_url", "url") ??
      nestedStringValue(linksRecord, "web", "href"),
    state: stringValue(record, "state", "status"),
    draft: booleanValue(record, "draft", "work_in_progress"),
    author:
      identityValue(authorRecord, "name", "username", "login") ??
      identityValue(submitterRecord, "title", "username"),
    repository:
      stringValue(record, "references", "repository") ??
      nestedStringValue(record, "references", "full") ??
      stringValue(record, "repository", "baseRepository", "repository_name"),
    sourceBranch: stringValue(record, "source_branch", "sourceBranch"),
    targetBranch: stringValue(record, "target_branch", "targetBranch"),
    updatedAt: normalizeUpdatedAt(stringValue(record, "updated_at", "updatedAt", "last_updated")),
    description,
    summary: stringValue(record, "summary"),
    raw: record,
  };
}

function normalizeCommit(item: unknown): ReviewCommit {
  const record = asRecord(item);
  const authorRecord = asRecord(record.author);

  return {
    id:
      stringValue(record, "id", "sha", "commit_id", "revision") ??
      String(numberValue(record, "id") ?? ""),
    title: stringValue(record, "title", "message") ?? stringValue(record, "summary") ?? "Commit",
    author:
      identityValue(authorRecord, "name", "username", "login") ??
      stringValue(record, "author_name", "author"),
    createdAt: normalizeUpdatedAt(
      stringValue(record, "created_at", "authored_date", "date", "timestamp")
    ),
    raw: record,
  };
}

function normalizeDiffFile(
  provider: ProviderId,
  item: unknown,
  diffSetId?: number
): ReviewDiffFile {
  const record = asRecord(item);
  const path =
    stringValue(
      record,
      "new_path",
      "filename",
      "dest_file",
      "destFile",
      "source_file",
      "sourceFile"
    ) ?? "Unknown file";

  return {
    id: String(
      numberValue(record, "id", "fileDiffId") ??
        stringValue(record, "filename", "new_path", "dest_file") ??
        path
    ),
    path,
    oldPath: stringValue(record, "old_path", "previous_filename", "source_file", "sourceFile"),
    status:
      stringValue(record, "status") ??
      (booleanValue(record, "new_file") ? "added" : undefined) ??
      (booleanValue(record, "deleted_file") ? "deleted" : undefined) ??
      (booleanValue(record, "renamed_file") ? "renamed" : undefined),
    additions: numberValue(record, "additions", "insertions"),
    deletions: numberValue(record, "deletions", "deleted"),
    patch: stringValue(record, "diff", "patch"),
    diffSetId,
    fileDiffId: provider === "reviewboard" ? numberValue(record, "id", "fileDiffId") : undefined,
    raw: record,
  };
}

function normalizeProviderRepository(
  provider: ProviderId,
  item: unknown
): ProviderRepositoryOption {
  const record = asRecord(item);

  if (provider === "gitlab") {
    const label =
      stringValue(record, "path_with_namespace", "path", "name") ?? "GitLab project";
    return {
      provider,
      id: String(numberValue(record, "id") ?? stringValue(record, "id") ?? label),
      label,
      subtitle: stringValue(record, "web_url"),
      description: stringValue(record, "description"),
      remoteUrl: stringValue(record, "web_url"),
      defaultBranch: stringValue(record, "default_branch"),
      visibility: stringValue(record, "visibility"),
    };
  }

  if (provider === "github") {
    const label = stringValue(record, "full_name", "name") ?? "GitHub repository";
    return {
      provider,
      id: String(numberValue(record, "id") ?? stringValue(record, "id") ?? label),
      label,
      subtitle: stringValue(record, "html_url"),
      description: stringValue(record, "description"),
      remoteUrl: stringValue(record, "html_url"),
      defaultBranch: stringValue(record, "default_branch"),
      visibility: stringValue(record, "visibility"),
      private: booleanValue(record, "private"),
    };
  }

  const label = stringValue(record, "title", "name", "path") ?? "Review Board repository";
  return {
    provider,
    id: String(numberValue(record, "id") ?? stringValue(record, "id") ?? label),
    label,
    subtitle: stringValue(record, "path", "mirror_path"),
    description: stringValue(record, "name"),
    repositoryId: numberValue(record, "id"),
  };
}

function providerListState(provider: ProviderId, state: ReviewState): string {
  if (provider === "reviewboard") {
    switch (state) {
      case "opened":
        return "pending";
      case "merged":
        return "submitted";
      default:
        return "all";
    }
  }

  if (provider === "github") {
    switch (state) {
      case "opened":
        return "open";
      case "merged":
        return "merged";
      case "closed":
        return "closed";
      default:
        return "all";
    }
  }

  return state;
}

function normalizeGitLabDiscussions(items: unknown[]): ReviewDiscussionThread[] {
  const threads: ReviewDiscussionThread[] = [];

  for (const item of items) {
    const discussion = asRecord(item);
    const messages = (Array.isArray(discussion.notes) ? discussion.notes : [])
      .map(asRecord)
      .filter((note) => !booleanValue(note, "system"))
      .map((note) => {
        const author = asRecord(note.author);
        const position = asRecord(note.position);
        const lineRange = asRecord(position.line_range);
        const lineRangeEnd = asRecord(lineRange.end);
        const inlinePath = stringValue(position, "new_path", "old_path") ?? "";
        const inlineLine = numberValue(position, "new_line", "old_line");
        const inlineEnd =
          numberValue(lineRangeEnd, "new_line", "old_line", "line") ?? inlineLine;
        const positionType: "new" | "old" =
          position.new_line !== undefined ? "new" : "old";

        return {
          id: String(numberValue(note, "id") ?? stringValue(note, "id") ?? "0"),
          body: stringValue(note, "body") ?? "",
          author: identityValue(author, "name", "username"),
          createdAt: normalizeUpdatedAt(stringValue(note, "created_at")),
          updatedAt: normalizeUpdatedAt(stringValue(note, "updated_at")),
          inline: inlinePath
            ? {
                filePath: inlinePath,
                line: inlineLine,
                endLine: inlineEnd,
                positionType,
              }
            : undefined,
        };
      })
      .filter((message) => message.body.trim().length > 0);

    if (messages.length === 0) {
      continue;
    }

    const firstInline = messages.find((message) => message.inline)?.inline;
    threads.push({
      id: String(stringValue(discussion, "id") ?? "0"),
      kind: firstInline ? "inline" : "general",
      title: firstInline
        ? `${firstInline.filePath}${firstInline.line ? `:${firstInline.line}` : ""}`
        : "General discussion",
      replyable: true,
      replyTargetId: String(stringValue(discussion, "id") ?? ""),
      resolved: booleanValue(discussion, "resolved"),
      messages,
    });
  }

  return threads.sort((left, right) => {
    const leftDate = Date.parse(left.messages[left.messages.length - 1]?.updatedAt ?? "");
    const rightDate = Date.parse(right.messages[right.messages.length - 1]?.updatedAt ?? "");
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  });
}

function normalizeGitHubDiscussions(payload: {
  issueComments?: unknown[];
  reviewComments?: unknown[];
}): ReviewDiscussionThread[] {
  const issueThreads = (payload.issueComments ?? []).map((item) => {
    const comment = asRecord(item);
    const author = asRecord(comment.user);

    return {
      id: `issue:${String(numberValue(comment, "id") ?? stringValue(comment, "id") ?? "0")}`,
      kind: "general" as const,
      title: `Comment from ${stringValue(author, "login") ?? "Reviewer"}`,
      replyable: false,
      messages: [
        {
          id: String(numberValue(comment, "id") ?? stringValue(comment, "id") ?? "0"),
          body: stringValue(comment, "body") ?? "",
          author: stringValue(author, "login"),
          createdAt: normalizeUpdatedAt(stringValue(comment, "created_at")),
          updatedAt: normalizeUpdatedAt(stringValue(comment, "updated_at")),
          url: stringValue(comment, "html_url"),
        },
      ],
    } satisfies ReviewDiscussionThread;
  });

  const reviewComments = (payload.reviewComments ?? []).map(asRecord);
  const reviewById = new Map<number, JsonObject>();
  reviewComments.forEach((comment) => {
    const id = numberValue(comment, "id");
    if (id !== undefined) {
      reviewById.set(id, comment);
    }
  });

  const rootIdFor = (comment: JsonObject) => {
    let current = comment;
    let parentId = numberValue(current, "inReplyToId", "in_reply_to_id");

    while (parentId !== undefined) {
      const parent = reviewById.get(parentId);
      if (!parent) {
        break;
      }
      current = parent;
      parentId = numberValue(current, "inReplyToId", "in_reply_to_id");
    }

    return numberValue(current, "id") ?? 0;
  };

  const reviewThreadsMap = new Map<number, JsonObject[]>();
  reviewComments.forEach((comment) => {
    const rootId = rootIdFor(comment);
    const thread = reviewThreadsMap.get(rootId) ?? [];
    thread.push(comment);
    reviewThreadsMap.set(rootId, thread);
  });

  const reviewThreads = Array.from(reviewThreadsMap.entries()).map(([rootId, comments]) => {
    const sorted = [...comments].sort((left, right) => {
      const leftDate = Date.parse(stringValue(left, "createdAt", "created_at") ?? "");
      const rightDate = Date.parse(stringValue(right, "createdAt", "created_at") ?? "");
      return (Number.isFinite(leftDate) ? leftDate : 0) - (Number.isFinite(rightDate) ? rightDate : 0);
    });
    const root = sorted[0] ?? {};
    const titlePath = stringValue(root, "filePath", "path") ?? "Inline thread";
    const titleLine = numberValue(root, "line", "start_line");
    const lastMessage = sorted[sorted.length - 1];

    return {
      id: `review:${rootId}`,
      kind: "inline" as const,
      title: `${titlePath}${titleLine ? `:${titleLine}` : ""}`,
      replyable: true,
      replyTargetId: String(numberValue(lastMessage, "id") ?? rootId),
      messages: sorted.map((comment) => {
        const author = asRecord(comment.user);
        const side = stringValue(comment, "side", "start_side");
        return {
          id: String(numberValue(comment, "id") ?? "0"),
          body: stringValue(comment, "body") ?? "",
          author: stringValue(author, "login", "name") ?? stringValue(comment, "author"),
          createdAt: normalizeUpdatedAt(stringValue(comment, "createdAt", "created_at")),
          updatedAt: normalizeUpdatedAt(stringValue(comment, "updatedAt", "updated_at")),
          url: stringValue(comment, "htmlUrl", "html_url"),
          inline: {
            filePath: stringValue(comment, "filePath", "path") ?? titlePath,
            line: numberValue(comment, "line", "start_line"),
            endLine: numberValue(comment, "endLine", "line"),
            positionType: side === "LEFT" ? "old" : "new",
          },
        };
      }),
    } satisfies ReviewDiscussionThread;
  });

  return [...reviewThreads, ...issueThreads].sort((left, right) => {
    const leftMessage = left.messages[left.messages.length - 1];
    const rightMessage = right.messages[right.messages.length - 1];
    const leftDate = Date.parse(leftMessage?.updatedAt ?? leftMessage?.createdAt ?? "");
    const rightDate = Date.parse(rightMessage?.updatedAt ?? rightMessage?.createdAt ?? "");
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  });
}

function queryWithRepositoryContext(path: string, context?: RepositoryContext): string {
  if (!context) {
    return path;
  }

  const params = new URLSearchParams();
  if (context.repoPath) {
    params.set("repoPath", context.repoPath);
  }
  if (context.remoteUrl) {
    params.set("remoteUrl", context.remoteUrl);
  }
  if (context.repositoryId !== undefined) {
    params.set("repositoryId", String(context.repositoryId));
  }

  const query = params.toString();
  return query ? `${path}${path.includes("?") ? "&" : "?"}${query}` : path;
}

export async function loadDashboard(context?: RepositoryContext): Promise<DashboardData> {
  return fetchJson<DashboardData>(queryWithRepositoryContext("/api/dashboard", context));
}

export async function loadLocalRepositories(): Promise<string[]> {
  const data = await fetchJson<{ repositories: string[] }>("/api/repositories/local");
  return data.repositories;
}

export async function loadProviderRepositories(
  provider: ProviderId
): Promise<ProviderRepositoryOption[]> {
  if (provider === "gitlab") {
    const data = await fetchJson<unknown[]>("/api/gitlab/repositories");
    return data.map((item) => normalizeProviderRepository(provider, item));
  }

  if (provider === "github") {
    const data = await fetchJson<unknown[]>("/api/github/repositories");
    return data.map((item) => normalizeProviderRepository(provider, item));
  }

  const data = await fetchJson<unknown[]>("/api/reviewboard/repositories");
  return data.map((item) => normalizeProviderRepository(provider, item));
}

export async function loadConfig(): Promise<CRConfigRecord> {
  return fetchJson<CRConfigRecord>("/api/config");
}

export async function saveConfig(config: CRConfigRecord): Promise<CRConfigRecord> {
  return fetchJson<CRConfigRecord>("/api/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function loadReviewAgents(): Promise<ReviewAgentOption[]> {
  const data = await fetchJson<{ options: ReviewAgentOption[] }>("/api/review/agents");
  return data.options;
}

export async function loadReviewTargets(
  provider: ProviderId,
  state: ReviewState,
  context?: RepositoryContext
): Promise<ReviewTarget[]> {
  if (provider === "gitlab") {
    const data = await fetchJson<unknown[]>(
      queryWithRepositoryContext(
        `/api/gitlab/merge-requests?state=${encodeURIComponent(providerListState(provider, state))}`,
        context
      )
    );
    return data.map((item) => normalizeReviewTarget(provider, item));
  }

  if (provider === "github") {
    const data = await fetchJson<unknown[]>(
      queryWithRepositoryContext(
        `/api/github/pull-requests?state=${encodeURIComponent(providerListState(provider, state))}`,
        context
      )
    );
    return data.map((item) => normalizeReviewTarget(provider, item));
  }

  const data = await fetchJson<unknown[]>(
    queryWithRepositoryContext(
      `/api/reviewboard/review-requests?status=${encodeURIComponent(providerListState(provider, state))}`,
      context
    )
  );
  return data.map((item) => normalizeReviewTarget(provider, item));
}

export async function loadReviewDetail(
  provider: ProviderId,
  targetId: number,
  context?: RepositoryContext
): Promise<ReviewTarget> {
  if (provider === "gitlab") {
    const data = await fetchJson(
      queryWithRepositoryContext(`/api/gitlab/merge-requests/${targetId}`, context)
    );
    return normalizeReviewTarget(provider, data);
  }

  if (provider === "github") {
    const data = await fetchJson(
      queryWithRepositoryContext(`/api/github/pull-requests/${targetId}`, context)
    );
    return normalizeReviewTarget(provider, data);
  }

  const data = await fetchJson(
    queryWithRepositoryContext(`/api/reviewboard/review-requests/${targetId}`, context)
  );
  return normalizeReviewTarget(provider, data);
}

export async function loadReviewDiffs(
  provider: ProviderId,
  targetId: number,
  context?: RepositoryContext
): Promise<ReviewDiffFile[]> {
  if (provider === "gitlab") {
    const data = await fetchJson<unknown[]>(
      queryWithRepositoryContext(`/api/gitlab/merge-requests/${targetId}/diffs`, context)
    );
    return data.map((item) => normalizeDiffFile(provider, item));
  }

  if (provider === "github") {
    const data = await fetchJson<unknown[]>(
      queryWithRepositoryContext(`/api/github/pull-requests/${targetId}/diffs`, context)
    );
    return data.map((item) => normalizeDiffFile(provider, item));
  }

  const data = await fetchJson<{ diffSet: { id: number } | null; files: unknown[] }>(
    queryWithRepositoryContext(`/api/reviewboard/review-requests/${targetId}/diffs`, context)
  );
  const diffSetId = data.diffSet?.id;
  return data.files.map((item) => normalizeDiffFile(provider, item, diffSetId));
}

export async function loadReviewBoardFilePatch(
  targetId: number,
  diffSetId: number,
  fileDiffId: number
): Promise<string> {
  const data = await fetchJson<{ diff?: string }>(
    `/api/reviewboard/review-requests/${targetId}/diffs/${diffSetId}/files/${fileDiffId}`
  );
  return typeof data.diff === "string" ? data.diff : "";
}

export async function loadReviewCommits(
  provider: ProviderId,
  targetId: number,
  context?: RepositoryContext
): Promise<ReviewCommit[]> {
  if (provider === "gitlab") {
    const data = await fetchJson<unknown[]>(
      queryWithRepositoryContext(`/api/gitlab/merge-requests/${targetId}/commits`, context)
    );
    return data.map(normalizeCommit);
  }

  if (provider === "github") {
    const data = await fetchJson<unknown[]>(
      queryWithRepositoryContext(`/api/github/pull-requests/${targetId}/commits`, context)
    );
    return data.map(normalizeCommit);
  }

  return [];
}

export async function loadReviewDiscussions(
  provider: ProviderId,
  targetId: number,
  context?: RepositoryContext
): Promise<ReviewDiscussionThread[]> {
  if (provider === "gitlab") {
    const data = await fetchJson<unknown[]>(
      queryWithRepositoryContext(`/api/gitlab/merge-requests/${targetId}/discussions`, context)
    );
    return normalizeGitLabDiscussions(data);
  }

  if (provider === "github") {
    const data = await fetchJson<{ issueComments?: unknown[]; reviewComments?: unknown[] }>(
      queryWithRepositoryContext(`/api/github/pull-requests/${targetId}/discussions`, context)
    );
    return normalizeGitHubDiscussions(data);
  }

  return [];
}

export async function runReview(args: {
  provider: ProviderId;
  targetId: number;
  agentNames: string[];
  inlineComments: boolean;
  userFeedback?: string;
  repoPath?: string;
  url?: string;
}): Promise<ReviewRunResponse> {
  return fetchJson<ReviewRunResponse>("/api/review/run", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function runSummary(args: {
  provider: ProviderId;
  targetId: number;
  repoPath?: string;
  url?: string;
}): Promise<ReviewSummaryResponse> {
  return fetchJson<ReviewSummaryResponse>("/api/review/summarize", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function loadChatContext(args: {
  provider: ProviderId;
  targetId: number;
  repoPath?: string;
  url?: string;
}): Promise<ReviewChatContext> {
  const data = await fetchJson<{ context: ReviewChatContext }>("/api/review/chat/context", {
    method: "POST",
    body: JSON.stringify(args),
  });
  return data.context;
}

export async function answerChatQuestion(args: {
  context: ReviewChatContext;
  question: string;
  history: ReviewChatHistoryEntry[];
}): Promise<{ answer: string; history: ReviewChatHistoryEntry[] }> {
  return fetchJson<{ answer: string; history: ReviewChatHistoryEntry[] }>(
    "/api/review/chat/answer",
    {
      method: "POST",
      body: JSON.stringify(args),
    }
  );
}

export async function postGeneratedReview(args: {
  provider: ProviderId;
  result: ReviewWorkflowResult;
}): Promise<ReviewPostResponse> {
  return fetchJson<ReviewPostResponse>("/api/review/post", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function postSummaryComment(args: {
  provider: ProviderId;
  targetId: number;
  body: string;
  repositoryContext?: RepositoryContext;
}): Promise<void> {
  if (args.provider === "gitlab") {
    await fetchJson(`/api/gitlab/merge-requests/${args.targetId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: args.body,
        repoPath: args.repositoryContext?.repoPath,
        url: args.repositoryContext?.remoteUrl,
      }),
    });
    return;
  }

  if (args.provider === "github") {
    await fetchJson(`/api/github/pull-requests/${args.targetId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: args.body,
        repoPath: args.repositoryContext?.repoPath,
        remoteUrl: args.repositoryContext?.remoteUrl,
      }),
    });
    return;
  }

  const review = await fetchJson<{ id: number }>(
    `/api/reviewboard/review-requests/${args.targetId}/reviews`,
    {
      method: "POST",
      body: JSON.stringify({ bodyTop: args.body }),
    }
  );
  await fetchJson(
    `/api/reviewboard/review-requests/${args.targetId}/reviews/${review.id}/publish`,
    {
      method: "POST",
    }
  );
}

export async function postInlineComment(args: {
  provider: ProviderId;
  targetId: number;
  filePath: string;
  line: number;
  positionType: "new" | "old";
  body: string;
  repositoryContext?: RepositoryContext;
}): Promise<void> {
  if (args.provider === "gitlab") {
    await fetchJson(`/api/gitlab/merge-requests/${args.targetId}/inline-comments`, {
      method: "POST",
      body: JSON.stringify({
        ...args,
        repoPath: args.repositoryContext?.repoPath,
        url: args.repositoryContext?.remoteUrl,
      }),
    });
    return;
  }

  if (args.provider === "github") {
    await fetchJson(`/api/github/pull-requests/${args.targetId}/inline-comments`, {
      method: "POST",
      body: JSON.stringify({
        repoPath: args.repositoryContext?.repoPath,
        remoteUrl: args.repositoryContext?.remoteUrl,
        body: args.body,
        filePath: args.filePath,
        line: args.line,
        side: args.positionType === "old" ? "LEFT" : "RIGHT",
      }),
    });
    return;
  }

  throw new Error("Inline comments are not supported for Review Board in the web workspace.");
}

export async function replyToReviewDiscussion(args: {
  provider: ProviderId;
  targetId: number;
  threadId: string;
  replyTargetId?: string;
  body: string;
  repositoryContext?: RepositoryContext;
}): Promise<void> {
  if (args.provider === "gitlab") {
    await fetchJson(`/api/gitlab/merge-requests/${args.targetId}/discussions/${encodeURIComponent(args.threadId)}/replies`, {
      method: "POST",
      body: JSON.stringify({
        body: args.body,
        repoPath: args.repositoryContext?.repoPath,
        url: args.repositoryContext?.remoteUrl,
      }),
    });
    return;
  }

  if (args.provider === "github") {
    if (!args.replyTargetId) {
      throw new Error("This discussion cannot accept replies.");
    }

    await fetchJson(`/api/github/pull-requests/${args.targetId}/review-comments/${encodeURIComponent(args.replyTargetId)}/replies`, {
      method: "POST",
      body: JSON.stringify({
        body: args.body,
        repoPath: args.repositoryContext?.repoPath,
        remoteUrl: args.repositoryContext?.remoteUrl,
      }),
    });
    return;
  }

  throw new Error("Discussion replies are not supported for Review Board in the web workspace.");
}

function githubDiscussionMessagePath(
  targetId: number,
  threadId: string,
  messageId: string
): string {
  const encodedMessageId = encodeURIComponent(messageId);

  if (threadId.startsWith("issue:")) {
    return `/api/github/pull-requests/${targetId}/issue-comments/${encodedMessageId}`;
  }

  if (threadId.startsWith("review:")) {
    return `/api/github/pull-requests/${targetId}/review-comments/${encodedMessageId}`;
  }

  throw new Error("Unsupported GitHub discussion thread.");
}

export async function updateReviewDiscussionMessage(args: {
  provider: ProviderId;
  targetId: number;
  threadId: string;
  messageId: string;
  body: string;
  repositoryContext?: RepositoryContext;
}): Promise<void> {
  if (args.provider === "gitlab") {
    await fetchJson(
      `/api/gitlab/merge-requests/${args.targetId}/discussions/${encodeURIComponent(args.threadId)}/notes/${encodeURIComponent(args.messageId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          body: args.body,
          repoPath: args.repositoryContext?.repoPath,
          url: args.repositoryContext?.remoteUrl,
        }),
      }
    );
    return;
  }

  if (args.provider === "github") {
    await fetchJson(githubDiscussionMessagePath(args.targetId, args.threadId, args.messageId), {
      method: "PATCH",
      body: JSON.stringify({
        body: args.body,
        repoPath: args.repositoryContext?.repoPath,
        remoteUrl: args.repositoryContext?.remoteUrl,
      }),
    });
    return;
  }

  throw new Error("Editing comments is not supported for Review Board after publish.");
}

export async function deleteReviewDiscussionMessage(args: {
  provider: ProviderId;
  targetId: number;
  threadId: string;
  messageId: string;
  repositoryContext?: RepositoryContext;
}): Promise<void> {
  if (args.provider === "gitlab") {
    await fetchJson(
      queryWithRepositoryContext(
        `/api/gitlab/merge-requests/${args.targetId}/discussions/${encodeURIComponent(args.threadId)}/notes/${encodeURIComponent(args.messageId)}`,
        args.repositoryContext
      ),
      {
        method: "DELETE",
      }
    );
    return;
  }

  if (args.provider === "github") {
    await fetchJson(
      queryWithRepositoryContext(
        githubDiscussionMessagePath(args.targetId, args.threadId, args.messageId),
        args.repositoryContext
      ),
      {
        method: "DELETE",
      }
    );
    return;
  }

  throw new Error("Deleting comments is not supported for Review Board after publish.");
}

export type TestConnectionResult = { ok: boolean; message: string };

export async function testConnection(
  provider: "gitlab" | "github" | "reviewboard" | "openai",
  overrides?: { url?: string; token?: string }
): Promise<TestConnectionResult> {
  const res = await fetch(`/api/test/${provider}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(overrides ?? {}),
  });
  return res.json() as Promise<TestConnectionResult>;
}
