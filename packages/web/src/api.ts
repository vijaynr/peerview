import type {
  DashboardData,
  ProviderId,
  ReviewAgentOption,
  ReviewChatContext,
  ReviewChatHistoryEntry,
  ReviewCommit,
  ReviewDiffFile,
  ReviewPostResponse,
  ReviewRunResponse,
  ReviewState,
  ReviewSummaryResponse,
  ReviewTarget,
  ReviewWorkflowResult,
} from "./types.js";

type JsonObject = Record<string, unknown>;

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
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
      stringValue(authorRecord, "name", "username", "login") ??
      stringValue(submitterRecord, "title", "username"),
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
    title:
      stringValue(record, "title", "message") ??
      stringValue(record, "summary") ??
      "Commit",
    author:
      stringValue(authorRecord, "name", "username", "login") ??
      stringValue(record, "author_name", "author"),
    createdAt: normalizeUpdatedAt(
      stringValue(record, "created_at", "authored_date", "date", "timestamp")
    ),
    raw: record,
  };
}

function normalizeDiffFile(provider: ProviderId, item: unknown, diffSetId?: number): ReviewDiffFile {
  const record = asRecord(item);
  const path =
    stringValue(record, "new_path", "filename", "dest_file", "destFile", "source_file", "sourceFile") ??
    "Unknown file";

  return {
    id: String(
      numberValue(record, "id", "fileDiffId") ?? stringValue(record, "filename", "new_path", "dest_file") ?? path
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
    fileDiffId:
      provider === "reviewboard"
        ? numberValue(record, "id", "fileDiffId")
        : undefined,
    raw: record,
  };
}

function providerListState(provider: ProviderId, state: ReviewState): string {
  if (provider === "reviewboard") {
    switch (state) {
      case "opened":
        return "pending";
      case "merged":
        return "submitted";
      case "closed":
      case "all":
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
      case "all":
      default:
        return "all";
    }
  }

  return state;
}

export async function loadDashboard(): Promise<DashboardData> {
  return fetchJson<DashboardData>("/api/dashboard");
}

export async function loadReviewAgents(): Promise<ReviewAgentOption[]> {
  const data = await fetchJson<{ options: ReviewAgentOption[] }>("/api/review/agents");
  return data.options;
}

export async function loadReviewTargets(
  provider: ProviderId,
  state: ReviewState
): Promise<ReviewTarget[]> {
  if (provider === "gitlab") {
    const data = await fetchJson<unknown[]>(
      `/api/gitlab/merge-requests?state=${encodeURIComponent(providerListState(provider, state))}`
    );
    return data.map((item) => normalizeReviewTarget(provider, item));
  }

  if (provider === "github") {
    const data = await fetchJson<unknown[]>(
      `/api/github/pull-requests?state=${encodeURIComponent(providerListState(provider, state))}`
    );
    return data.map((item) => normalizeReviewTarget(provider, item));
  }

  const data = await fetchJson<unknown[]>(
    `/api/reviewboard/review-requests?status=${encodeURIComponent(providerListState(provider, state))}`
  );
  return data.map((item) => normalizeReviewTarget(provider, item));
}

export async function loadReviewDetail(provider: ProviderId, targetId: number): Promise<ReviewTarget> {
  if (provider === "gitlab") {
    const data = await fetchJson(`/api/gitlab/merge-requests/${targetId}`);
    return normalizeReviewTarget(provider, data);
  }

  if (provider === "github") {
    const data = await fetchJson(`/api/github/pull-requests/${targetId}`);
    return normalizeReviewTarget(provider, data);
  }

  const data = await fetchJson(`/api/reviewboard/review-requests/${targetId}`);
  return normalizeReviewTarget(provider, data);
}

export async function loadReviewDiffs(
  provider: ProviderId,
  targetId: number
): Promise<ReviewDiffFile[]> {
  if (provider === "gitlab") {
    const data = await fetchJson<unknown[]>(`/api/gitlab/merge-requests/${targetId}/diffs`);
    return data.map((item) => normalizeDiffFile(provider, item));
  }

  if (provider === "github") {
    const data = await fetchJson<unknown[]>(`/api/github/pull-requests/${targetId}/diffs`);
    return data.map((item) => normalizeDiffFile(provider, item));
  }

  const data = await fetchJson<{ diffSet: { id: number } | null; files: unknown[] }>(
    `/api/reviewboard/review-requests/${targetId}/diffs`
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
  targetId: number
): Promise<ReviewCommit[]> {
  if (provider === "gitlab") {
    const data = await fetchJson<unknown[]>(`/api/gitlab/merge-requests/${targetId}/commits`);
    return data.map(normalizeCommit);
  }

  if (provider === "github") {
    const data = await fetchJson<unknown[]>(`/api/github/pull-requests/${targetId}/commits`);
    return data.map(normalizeCommit);
  }

  return [];
}

export async function runReview(args: {
  provider: ProviderId;
  targetId: number;
  agentNames: string[];
  inlineComments: boolean;
  userFeedback?: string;
}): Promise<ReviewRunResponse> {
  return fetchJson<ReviewRunResponse>("/api/review/run", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function runSummary(args: {
  provider: ProviderId;
  targetId: number;
}): Promise<ReviewSummaryResponse> {
  return fetchJson<ReviewSummaryResponse>("/api/review/summarize", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function loadChatContext(args: {
  provider: ProviderId;
  targetId: number;
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
}): Promise<void> {
  if (args.provider === "gitlab") {
    await fetchJson(`/api/gitlab/merge-requests/${args.targetId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: args.body }),
    });
    return;
  }

  if (args.provider === "github") {
    await fetchJson(`/api/github/pull-requests/${args.targetId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: args.body }),
    });
    return;
  }

  const review = await fetchJson<{ id: number }>(`/api/reviewboard/review-requests/${args.targetId}/reviews`, {
    method: "POST",
    body: JSON.stringify({ bodyTop: args.body }),
  });
  await fetchJson(`/api/reviewboard/review-requests/${args.targetId}/reviews/${review.id}/publish`, {
    method: "POST",
  });
}

export async function postInlineComment(args: {
  provider: ProviderId;
  targetId: number;
  filePath: string;
  line: number;
  positionType: "new" | "old";
  body: string;
}): Promise<void> {
  if (args.provider === "gitlab") {
    await fetchJson(`/api/gitlab/merge-requests/${args.targetId}/inline-comments`, {
      method: "POST",
      body: JSON.stringify(args),
    });
    return;
  }

  if (args.provider === "github") {
    await fetchJson(`/api/github/pull-requests/${args.targetId}/inline-comments`, {
      method: "POST",
      body: JSON.stringify({
        repoPath: undefined,
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
