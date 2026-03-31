import { Hono } from "hono";
import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  addDiffComment,
  addGitHubInlinePullRequestComment,
  addGitHubPullRequestComment,
  addInlineMergeRequestComment,
  addMergeRequestComment,
  createReview,
  createReviewRequest,
  deleteGitHubPullRequestComment,
  deleteGitHubReviewComment,
  deleteMergeRequestDiscussionNote,
  defaultConfig,
  getFileDiffData,
  getFileDiffs,
  getGitHubPullRequest,
  getGitHubPullRequestCommits,
  getGitHubPullRequestFiles,
  listGitHubIssueComments,
  listGitHubRepositories,
  listGitHubReviewComments,
  getLatestDiffSet,
  getMergeRequest,
  getMergeRequestChanges,
  getMergeRequestCommits,
  getOriginRemoteUrl,
  getReviewRequest,
  listGitHubPullRequests,
  listGitLabProjects,
  listMergeRequests,
  listMergeRequestDiscussions,
  listRepositories,
  listReviewRequests,
  loadPVConfig,
  listBundledReviewAgentNames,
  normalizeReviewAgentNames,
  publishReview,
  publishReviewRequest,
  repoRootFromModule,
  replyToGitHubReviewComment,
  replyToMergeRequestDiscussion,
  remoteToGitHubRepoPath,
  remoteToProjectPath,
  saveCRConfig,
  updateGitHubPullRequestComment,
  updateGitHubReviewComment,
  updateMergeRequestDiscussionNote,
  updateReviewRequestDraft,
  uploadReviewRequestDiff,
} from "@pv/core";
import type {
  CRConfig,
  MergeRequestState,
  ReviewChatContext,
  ReviewChatHistoryEntry,
  ReviewWorkflowResult,
} from "@pv/core";
import {
  answerReviewChatQuestion,
  maybePostGitHubReviewComment,
  maybePostReviewBoardComment,
  maybePostReviewComment,
  runReviewChatWorkflow,
  runReviewSummarizeWorkflow,
  runReviewWorkflow,
} from "@pv/workflows";
import type { ServerContext } from "../types.js";

const API_PREFIX = "/api";

type ProviderName = "gitlab" | "github" | "reviewboard";
type ReviewWorkflowBody = {
  provider?: ProviderName;
  targetId?: number;
  state?: MergeRequestState;
  url?: string;
  projectPath?: string;
  repoPath?: string;
  fromUser?: string;
  agentNames?: string[];
  inlineComments?: boolean;
  userFeedback?: string;
};

const REVIEW_AGENT_DESCRIPTIONS: Record<string, string> = {
  general: "Checks correctness, reliability, tests, and overall code quality.",
  security: "Focuses on auth, secrets, permissions, validation, and exploit risks.",
  "clean-code": "Looks for readability, maintainability, duplication, and refactor opportunities.",
  performance: "Checks hot paths, query patterns, rendering churn, and likely runtime regressions.",
  "test-quality":
    "Looks for missing coverage, weak assertions, flaky tests, and untested edge cases.",
};

function getBaseConfig(existing: Partial<CRConfig>): CRConfig {
  return {
    openaiApiUrl: existing.openaiApiUrl || defaultConfig.openaiApiUrl,
    openaiApiKey: existing.openaiApiKey || "",
    openaiModel: existing.openaiModel || defaultConfig.openaiModel,
    useCustomStreaming: existing.useCustomStreaming ?? false,
    defaultReviewAgents: existing.defaultReviewAgents,
    gitlabUrl: existing.gitlabUrl || defaultConfig.gitlabUrl,
    gitlabKey: existing.gitlabKey || "",
    githubToken: existing.githubToken,
    svnRepositoryUrl: existing.svnRepositoryUrl,
    svnUsername: existing.svnUsername,
    svnPassword: existing.svnPassword,
    rbUrl: existing.rbUrl || defaultConfig.rbUrl,
    rbToken: existing.rbToken,
    gitlabWebhookSecret: existing.gitlabWebhookSecret,
    githubWebhookSecret: existing.githubWebhookSecret,
    rbWebhookSecret: existing.rbWebhookSecret,
    sslCertPath: existing.sslCertPath,
    sslKeyPath: existing.sslKeyPath,
    sslCaPath: existing.sslCaPath,
    webhookConcurrency: existing.webhookConcurrency,
    webhookQueueLimit: existing.webhookQueueLimit,
    webhookJobTimeoutMs: existing.webhookJobTimeoutMs,
    terminalTheme: existing.terminalTheme,
    gitlabEnabled: existing.gitlabEnabled,
    githubEnabled: existing.githubEnabled,
    reviewboardEnabled: existing.reviewboardEnabled,
    gitlabWebhookEnabled: existing.gitlabWebhookEnabled,
    githubWebhookEnabled: existing.githubWebhookEnabled,
    reviewboardWebhookEnabled: existing.reviewboardWebhookEnabled,
  };
}

async function requireGitLabConfig() {
  const config = await loadPVConfig();
  if (!config.gitlabUrl || !config.gitlabKey) {
    throw new Error("Missing GitLab configuration.");
  }
  return { config, baseUrl: config.gitlabUrl, token: config.gitlabKey };
}

async function requireGitHubConfig() {
  const config = await loadPVConfig();
  if (!config.githubToken) {
    throw new Error("Missing GitHub configuration.");
  }
  return { config, token: config.githubToken };
}

async function requireReviewBoardConfig() {
  const config = await loadPVConfig();
  if (!config.rbUrl || !config.rbToken) {
    throw new Error("Missing Review Board configuration.");
  }
  return { config, baseUrl: config.rbUrl, token: config.rbToken };
}

function badRequest(message: string): Response {
  return Response.json({ status: "error", message }, { status: 400 });
}

function serverError(message: string): Response {
  return Response.json({ status: "error", message }, { status: 500 });
}

function parseInteger(value: string | undefined, name: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}.`);
  }
  return parsed;
}

function formatReviewAgentTitle(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getReviewAgentDescription(name: string): string {
  return REVIEW_AGENT_DESCRIPTIONS[name] || "Runs a specialized review prompt for this agent.";
}

function ensureProvider(value: ProviderName | undefined): ProviderName {
  if (!value) {
    throw new Error("Missing provider.");
  }
  return value;
}

function ensureTargetId(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error("Missing targetId.");
  }
  return value;
}

function buildReviewWarnings(body: ReviewWorkflowBody): string[] {
  const warnings: string[] = [];
  const selectedAgents = normalizeReviewAgentNames(body.agentNames);

  if (body.provider === "reviewboard" && body.inlineComments) {
    warnings.push(
      "Review Board supports summary comments only; inline comments will not be posted."
    );
  }

  if (body.inlineComments && selectedAgents.length > 1) {
    warnings.push(
      "Multi-agent review does not support inline comments yet. This run will produce a summary comment only."
    );
  }

  return warnings;
}

function createWorkflowInput(
  context: ServerContext,
  body: ReviewWorkflowBody,
  workflow: "review" | "summarize" | "chat"
) {
  const provider = ensureProvider(body.provider);
  const targetId = ensureTargetId(body.targetId);
  const repoRoot = repoRootFromModule(import.meta.url);
  const selectedAgents = normalizeReviewAgentNames(body.agentNames);

  return {
    repoPath: body.repoPath || context.repoPath,
    repoRoot,
    mode: "interactive" as const,
    workflow,
    local: false,
    provider,
    agentNames: workflow === "review" ? selectedAgents : undefined,
    agentMode: selectedAgents.length > 1 ? ("multi" as const) : ("single" as const),
    url: body.url,
    fromUser: body.fromUser,
    state: body.state ?? "opened",
    mrIid: provider === "github" ? undefined : targetId,
    prNumber: provider === "github" ? targetId : undefined,
    inlineComments: provider === "reviewboard" ? false : Boolean(body.inlineComments),
    userFeedback: body.userFeedback,
  };
}

async function discoverLocalGitRepositories(baseRepoPath: string): Promise<string[]> {
  const root = path.resolve(path.dirname(baseRepoPath));
  const seen = new Set<string>();
  const repos: string[] = [];

  async function walk(currentPath: string, depth: number) {
    if (depth > 2 || repos.length >= 50 || seen.has(currentPath)) {
      return;
    }

    seen.add(currentPath);

    try {
      const entries = await readdir(currentPath, { withFileTypes: true });
      if (entries.some((entry) => entry.isDirectory() && entry.name === ".git")) {
        repos.push(currentPath);
        return;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (entry.name.startsWith(".") || entry.name === "node_modules") {
          continue;
        }
        await walk(path.join(currentPath, entry.name), depth + 1);
        if (repos.length >= 50) {
          return;
        }
      }
    } catch {
      return;
    }
  }

  await walk(root, 0);

  if (!repos.includes(baseRepoPath)) {
    repos.unshift(path.resolve(baseRepoPath));
  }

  return repos;
}

async function resolveGitLabProjectPath(args: {
  defaultRepoPath: string;
  repoPath?: string;
  explicitProjectPath?: string;
  remoteUrl?: string;
}): Promise<string> {
  if (args.explicitProjectPath) {
    return args.explicitProjectPath;
  }

  if (args.remoteUrl) {
    return remoteToProjectPath(args.remoteUrl);
  }

  const repoPath = args.repoPath || args.defaultRepoPath;
  const remoteUrl = await getOriginRemoteUrl(repoPath);
  if (!remoteUrl) {
    throw new Error("Could not infer GitLab project path from the selected repository.");
  }

  return remoteToProjectPath(remoteUrl);
}

async function resolveGitHubRepoPath(args: {
  defaultRepoPath: string;
  repoPath?: string;
  explicitRepoPath?: string;
  remoteUrl?: string;
}): Promise<string> {
  if (args.explicitRepoPath) {
    return args.explicitRepoPath;
  }

  if (args.remoteUrl) {
    return remoteToGitHubRepoPath(args.remoteUrl);
  }

  const repoPath = args.repoPath || args.defaultRepoPath;
  const remoteUrl = await getOriginRemoteUrl(repoPath);
  if (!remoteUrl) {
    throw new Error("Could not infer GitHub repository path from the selected repository.");
  }

  return remoteToGitHubRepoPath(remoteUrl);
}

const operations = [
  {
    group: "config",
    operations: [
      { method: "GET", path: "/api/config", description: "Read persisted CR configuration." },
      { method: "PUT", path: "/api/config", description: "Update persisted CR configuration." },
    ],
  },
  {
    group: "review",
    operations: [
      { method: "GET", path: "/api/review/agents", description: "List available review agents." },
      {
        method: "POST",
        path: "/api/review/run",
        description: "Run AI review for a selected target.",
      },
      {
        method: "POST",
        path: "/api/review/summarize",
        description: "Generate a summary for a selected target.",
      },
      {
        method: "POST",
        path: "/api/review/chat/context",
        description: "Prepare review chat context for a selected target.",
      },
      {
        method: "POST",
        path: "/api/review/chat/answer",
        description: "Answer a question about the active review context.",
      },
      {
        method: "POST",
        path: "/api/review/post",
        description: "Post a generated review result back to the provider.",
      },
    ],
  },
  {
    group: "gitlab",
    operations: [
      { method: "GET", path: "/api/gitlab/merge-requests", description: "List merge requests." },
      { method: "GET", path: "/api/gitlab/repositories", description: "List accessible GitLab repositories." },
      {
        method: "GET",
        path: "/api/gitlab/merge-requests/:iid",
        description: "Get merge request details.",
      },
      {
        method: "GET",
        path: "/api/gitlab/merge-requests/:iid/diffs",
        description: "Get merge request diffs.",
      },
      {
        method: "GET",
        path: "/api/gitlab/merge-requests/:iid/commits",
        description: "Get merge request commits.",
      },
      {
        method: "GET",
        path: "/api/gitlab/merge-requests/:iid/discussions",
        description: "Get merge request discussions and comments.",
      },
      {
        method: "POST",
        path: "/api/gitlab/merge-requests/:iid/comments",
        description: "Add a merge request comment.",
      },
      {
        method: "POST",
        path: "/api/gitlab/merge-requests/:iid/discussions/:discussionId/replies",
        description: "Reply to a merge request discussion thread.",
      },
      {
        method: "PATCH",
        path: "/api/gitlab/merge-requests/:iid/discussions/:discussionId/notes/:noteId",
        description: "Edit a merge request discussion note.",
      },
      {
        method: "DELETE",
        path: "/api/gitlab/merge-requests/:iid/discussions/:discussionId/notes/:noteId",
        description: "Delete a merge request discussion note.",
      },
      {
        method: "POST",
        path: "/api/gitlab/merge-requests/:iid/inline-comments",
        description: "Add an inline merge request comment.",
      },
    ],
  },
  {
    group: "github",
    operations: [
      { method: "GET", path: "/api/github/pull-requests", description: "List pull requests." },
      { method: "GET", path: "/api/github/repositories", description: "List accessible GitHub repositories." },
      {
        method: "GET",
        path: "/api/github/pull-requests/:number",
        description: "Get pull request details.",
      },
      {
        method: "GET",
        path: "/api/github/pull-requests/:number/diffs",
        description: "Get pull request changed files.",
      },
      {
        method: "GET",
        path: "/api/github/pull-requests/:number/commits",
        description: "Get pull request commits.",
      },
      {
        method: "GET",
        path: "/api/github/pull-requests/:number/discussions",
        description: "Get pull request comments and review threads.",
      },
      {
        method: "POST",
        path: "/api/github/pull-requests/:number/comments",
        description: "Add a pull request comment.",
      },
      {
        method: "PATCH",
        path: "/api/github/pull-requests/:number/issue-comments/:commentId",
        description: "Edit a pull request conversation comment.",
      },
      {
        method: "DELETE",
        path: "/api/github/pull-requests/:number/issue-comments/:commentId",
        description: "Delete a pull request conversation comment.",
      },
      {
        method: "POST",
        path: "/api/github/pull-requests/:number/review-comments/:commentId/replies",
        description: "Reply to an inline review comment thread.",
      },
      {
        method: "PATCH",
        path: "/api/github/pull-requests/:number/review-comments/:commentId",
        description: "Edit a pull request review comment.",
      },
      {
        method: "DELETE",
        path: "/api/github/pull-requests/:number/review-comments/:commentId",
        description: "Delete a pull request review comment.",
      },
      {
        method: "POST",
        path: "/api/github/pull-requests/:number/inline-comments",
        description: "Add an inline pull request comment.",
      },
    ],
  },
  {
    group: "reviewboard",
    operations: [
      { method: "GET", path: "/api/reviewboard/repositories", description: "List repositories." },
      {
        method: "GET",
        path: "/api/reviewboard/review-requests",
        description: "List review requests.",
      },
      {
        method: "GET",
        path: "/api/reviewboard/review-requests/:id",
        description: "Get review request details.",
      },
      {
        method: "GET",
        path: "/api/reviewboard/review-requests/:id/diffs",
        description: "Get latest or specific diffset and file diffs.",
      },
      {
        method: "GET",
        path: "/api/reviewboard/review-requests/:id/diffs/:diffSetId/files/:fileDiffId",
        description: "Get file diff data.",
      },
      {
        method: "POST",
        path: "/api/reviewboard/review-requests",
        description: "Create a review request.",
      },
      {
        method: "PUT",
        path: "/api/reviewboard/review-requests/:id",
        description: "Update a review request draft.",
      },
      {
        method: "POST",
        path: "/api/reviewboard/review-requests/:id/diffs",
        description: "Upload a diff to a review request.",
      },
      {
        method: "POST",
        path: "/api/reviewboard/review-requests/:id/publish",
        description: "Publish a review request draft.",
      },
      {
        method: "POST",
        path: "/api/reviewboard/review-requests/:id/reviews",
        description: "Create a review.",
      },
      {
        method: "POST",
        path: "/api/reviewboard/review-requests/:id/reviews/:reviewId/diff-comments",
        description: "Add a diff comment to a review.",
      },
      {
        method: "POST",
        path: "/api/reviewboard/review-requests/:id/reviews/:reviewId/publish",
        description: "Publish a review.",
      },
    ],
  },
  {
    group: "test",
    operations: [
      { method: "POST", path: "/api/test/gitlab", description: "Test GitLab connection with current or provided credentials." },
      { method: "POST", path: "/api/test/github", description: "Test GitHub connection with current or provided credentials." },
      { method: "POST", path: "/api/test/reviewboard", description: "Test Review Board connection with current or provided credentials." },
      { method: "POST", path: "/api/test/openai", description: "Test OpenAI/LLM connection with current or provided credentials." },
    ],
  },
];

export function createApiRoutes(context: ServerContext): Hono {
  const app = new Hono();

  app.get(`${API_PREFIX}/operations`, (c) =>
    c.json({
      groups: operations,
      repoPath: context.repoPath,
    })
  );

  app.get(`${API_PREFIX}/repositories/local`, async (c) => {
    try {
      const repositories = await discoverLocalGitRepositories(context.repoPath);
      return c.json({
        repositories,
      });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/config`, async (c) => {
    const config = await loadPVConfig();
    return c.json(config);
  });

  app.put(`${API_PREFIX}/config`, async (c) => {
    const body = (await c.req.json()) as Partial<CRConfig>;
    const existing = await loadPVConfig();
    const nextConfig = {
      ...getBaseConfig(existing),
      ...body,
    };
    await saveCRConfig(nextConfig);
    return c.json(nextConfig);
  });

  // Test connection endpoints — each accepts optional {url?, token?} overrides,
  // falling back to saved config when not provided.
  app.post(`${API_PREFIX}/test/gitlab`, async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as { url?: string; token?: string };
      const config = await loadPVConfig();
      const baseUrl = (body.url || config.gitlabUrl || "").replace(/\/+$/, "");
      const token = body.token || config.gitlabKey || "";
      if (!baseUrl || !token) {
        return c.json({ ok: false, message: "GitLab URL and token are required." });
      }
      const res = await fetch(`${baseUrl}/api/v4/user`, {
        headers: { "PRIVATE-TOKEN": token },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return c.json({ ok: false, message: `GitLab responded with ${res.status}: ${text}` });
      }
      const user = (await res.json()) as { username?: string; name?: string };
      return c.json({ ok: true, message: `Connected as ${user.username ?? user.name ?? "unknown"}` });
    } catch (error) {
      return c.json({ ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post(`${API_PREFIX}/test/github`, async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as { url?: string; token?: string };
      const config = await loadPVConfig();
      const token = body.token || config.githubToken || "";
      if (!token) {
        return c.json({ ok: false, message: "GitHub token is required." });
      }
      // Support GitHub Enterprise Server: use /api/v3 prefix when a custom URL is set
      const configuredUrl = (body.url || config.githubUrl || "").replace(/\/+$/, "");
      const apiBase = configuredUrl && !configuredUrl.includes("github.com")
        ? `${configuredUrl}/api/v3`
        : "https://api.github.com";
      const res = await fetch(`${apiBase}/user`, {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return c.json({ ok: false, message: `GitHub responded with ${res.status}: ${text}` });
      }
      const user = (await res.json()) as { login?: string; name?: string };
      return c.json({ ok: true, message: `Connected as ${user.login ?? user.name ?? "unknown"}` });
    } catch (error) {
      return c.json({ ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post(`${API_PREFIX}/test/reviewboard`, async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as { url?: string; token?: string };
      const config = await loadPVConfig();
      const baseUrl = (body.url || config.rbUrl || "").replace(/\/+$/, "");
      const token = body.token || config.rbToken || "";
      if (!baseUrl || !token) {
        return c.json({ ok: false, message: "Review Board URL and token are required." });
      }
      const res = await fetch(`${baseUrl}/api/users/me/`, {
        headers: { Authorization: `token ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return c.json({ ok: false, message: `Review Board responded with ${res.status}: ${text}` });
      }
      const data = (await res.json()) as { user?: { username?: string } };
      const username = data.user?.username ?? "unknown";
      return c.json({ ok: true, message: `Connected as ${username}` });
    } catch (error) {
      return c.json({ ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post(`${API_PREFIX}/test/openai`, async (c) => {
    try {
      const body = (await c.req.json().catch(() => ({}))) as { url?: string; token?: string };
      const config = await loadPVConfig();
      const apiUrl = (body.url || config.openaiApiUrl || "").replace(/\/+$/, "");
      const apiKey = body.token || config.openaiApiKey || "";
      if (!apiUrl || !apiKey) {
        return c.json({ ok: false, message: "OpenAI API URL and key are required." });
      }
      const res = await fetch(`${apiUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return c.json({ ok: false, message: `LLM API responded with ${res.status}: ${text}` });
      }
      const data = (await res.json()) as { data?: { id: string }[] };
      const modelCount = data.data?.length ?? 0;
      return c.json({ ok: true, message: `Connected — ${modelCount} model${modelCount !== 1 ? "s" : ""} available` });
    } catch (error) {
      return c.json({ ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get(`${API_PREFIX}/review/agents`, async (c) => {
    try {
      const config = await loadPVConfig();
      const defaultAgents = normalizeReviewAgentNames(config.defaultReviewAgents);
      const availableAgents = Array.from(
        new Set([...listBundledReviewAgentNames(), ...defaultAgents])
      ).sort();

      return c.json({
        options: availableAgents.map((name) => ({
          title: formatReviewAgentTitle(name),
          value: name,
          description: getReviewAgentDescription(name),
          selected: defaultAgents.includes(name),
        })),
      });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/review/run`, async (c) => {
    try {
      const body = (await c.req.json()) as ReviewWorkflowBody;
      const result = await runReviewWorkflow(createWorkflowInput(context, body, "review"));
      return c.json({
        result,
        warnings: buildReviewWarnings(body),
      });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/review/summarize`, async (c) => {
    try {
      const body = (await c.req.json()) as ReviewWorkflowBody;
      const result = await runReviewSummarizeWorkflow(
        createWorkflowInput(context, body, "summarize")
      );
      return c.json({ result });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/review/chat/context`, async (c) => {
    try {
      const body = (await c.req.json()) as ReviewWorkflowBody;
      const contextResult = await runReviewChatWorkflow(createWorkflowInput(context, body, "chat"));
      return c.json({ context: contextResult });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/review/chat/answer`, async (c) => {
    try {
      const body = (await c.req.json()) as {
        context?: ReviewChatContext;
        question?: string;
        history?: ReviewChatHistoryEntry[];
      };
      if (!body.context || !body.question) {
        return badRequest("Missing chat context or question.");
      }

      const answer = await answerReviewChatQuestion({
        repoRoot: repoRootFromModule(import.meta.url),
        context: body.context,
        question: body.question,
        history: Array.isArray(body.history) ? body.history : [],
      });
      return c.json(answer);
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/review/post`, async (c) => {
    try {
      const body = (await c.req.json()) as {
        provider?: ProviderName;
        result?: ReviewWorkflowResult;
      };

      if (!body.result) {
        return badRequest("Missing review result.");
      }

      const provider = ensureProvider(body.provider);
      let posted: { summaryNoteId?: string; inlineNoteIds: string[] } | null = null;

      if (provider === "github") {
        const { token } = await requireGitHubConfig();
        posted = await maybePostGitHubReviewComment(body.result, "interactive", true, token);
      } else if (provider === "reviewboard") {
        const { token } = await requireReviewBoardConfig();
        posted = await maybePostReviewBoardComment(body.result, "interactive", true, token);
      } else {
        const { token } = await requireGitLabConfig();
        posted = await maybePostReviewComment(body.result, "interactive", true, token);
      }

      if (!posted) {
        return badRequest("Review result is missing provider metadata required for posting.");
      }

      return c.json({ posted });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/gitlab/merge-requests`, async (c) => {
    try {
      const { baseUrl, token } = await requireGitLabConfig();
      const projectPath = await resolveGitLabProjectPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        explicitProjectPath: c.req.query("projectPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const state = (c.req.query("state") as "opened" | "closed" | "merged" | "all") || "opened";
      return c.json(await listMergeRequests(baseUrl, token, projectPath, state));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/gitlab/repositories`, async (c) => {
    try {
      const { baseUrl, token } = await requireGitLabConfig();
      return c.json(await listGitLabProjects(baseUrl, token));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/gitlab/merge-requests/:iid`, async (c) => {
    try {
      const { baseUrl, token } = await requireGitLabConfig();
      const projectPath = await resolveGitLabProjectPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        explicitProjectPath: c.req.query("projectPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const iid = parseInteger(c.req.param("iid"), "merge request iid");
      return c.json(await getMergeRequest(baseUrl, token, projectPath, iid));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/gitlab/merge-requests/:iid/diffs`, async (c) => {
    try {
      const { baseUrl, token } = await requireGitLabConfig();
      const projectPath = await resolveGitLabProjectPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        explicitProjectPath: c.req.query("projectPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const iid = parseInteger(c.req.param("iid"), "merge request iid");
      return c.json(await getMergeRequestChanges(baseUrl, token, projectPath, iid));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/gitlab/merge-requests/:iid/commits`, async (c) => {
    try {
      const { baseUrl, token } = await requireGitLabConfig();
      const projectPath = await resolveGitLabProjectPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        explicitProjectPath: c.req.query("projectPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const iid = parseInteger(c.req.param("iid"), "merge request iid");
      return c.json(await getMergeRequestCommits(baseUrl, token, projectPath, iid));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/gitlab/merge-requests/:iid/discussions`, async (c) => {
    try {
      const { baseUrl, token } = await requireGitLabConfig();
      const projectPath = await resolveGitLabProjectPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        explicitProjectPath: c.req.query("projectPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const iid = parseInteger(c.req.param("iid"), "merge request iid");
      return c.json(await listMergeRequestDiscussions(baseUrl, token, projectPath, iid));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/gitlab/merge-requests/:iid/comments`, async (c) => {
    try {
      const body = (await c.req.json()) as {
        repoPath?: string;
        projectPath?: string;
        url?: string;
        body?: string;
      };
      if (!body.body) {
        return badRequest("Missing comment body.");
      }
      const { baseUrl, token } = await requireGitLabConfig();
      const projectPath = await resolveGitLabProjectPath({
        defaultRepoPath: context.repoPath,
        repoPath: body.repoPath,
        explicitProjectPath: body.projectPath,
        remoteUrl: body.url,
      });
      const iid = parseInteger(c.req.param("iid"), "merge request iid");
      const url = await addMergeRequestComment(baseUrl, token, projectPath, iid, body.body);
      return c.json({ url });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/gitlab/merge-requests/:iid/discussions/:discussionId/replies`, async (c) => {
    try {
      const body = (await c.req.json()) as {
        repoPath?: string;
        projectPath?: string;
        url?: string;
        body?: string;
      };
      if (!body.body) {
        return badRequest("Missing reply body.");
      }
      const { baseUrl, token } = await requireGitLabConfig();
      const projectPath = await resolveGitLabProjectPath({
        defaultRepoPath: context.repoPath,
        repoPath: body.repoPath,
        explicitProjectPath: body.projectPath,
        remoteUrl: body.url,
      });
      const iid = parseInteger(c.req.param("iid"), "merge request iid");
      const discussionId = c.req.param("discussionId");
      const note = await replyToMergeRequestDiscussion(
        baseUrl,
        token,
        projectPath,
        iid,
        discussionId,
        body.body
      );
      return c.json({ note });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.patch(
    `${API_PREFIX}/gitlab/merge-requests/:iid/discussions/:discussionId/notes/:noteId`,
    async (c) => {
      try {
        const body = (await c.req.json()) as {
          repoPath?: string;
          projectPath?: string;
          url?: string;
          body?: string;
        };
        if (!body.body) {
          return badRequest("Missing note body.");
        }
        const { baseUrl, token } = await requireGitLabConfig();
        const projectPath = await resolveGitLabProjectPath({
          defaultRepoPath: context.repoPath,
          repoPath: body.repoPath,
          explicitProjectPath: body.projectPath,
          remoteUrl: body.url,
        });
        const iid = parseInteger(c.req.param("iid"), "merge request iid");
        const discussionId = c.req.param("discussionId");
        const noteId = parseInteger(c.req.param("noteId"), "discussion note id");
        const note = await updateMergeRequestDiscussionNote(
          baseUrl,
          token,
          projectPath,
          iid,
          discussionId,
          noteId,
          body.body
        );
        return c.json({ note });
      } catch (error) {
        return serverError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  app.delete(
    `${API_PREFIX}/gitlab/merge-requests/:iid/discussions/:discussionId/notes/:noteId`,
    async (c) => {
      try {
        const { baseUrl, token } = await requireGitLabConfig();
        const projectPath = await resolveGitLabProjectPath({
          defaultRepoPath: context.repoPath,
          repoPath: c.req.query("repoPath") ?? undefined,
          explicitProjectPath: c.req.query("projectPath") ?? undefined,
          remoteUrl: c.req.query("remoteUrl") ?? undefined,
        });
        const iid = parseInteger(c.req.param("iid"), "merge request iid");
        const discussionId = c.req.param("discussionId");
        const noteId = parseInteger(c.req.param("noteId"), "discussion note id");
        await deleteMergeRequestDiscussionNote(
          baseUrl,
          token,
          projectPath,
          iid,
          discussionId,
          noteId
        );
        return c.json({ ok: true });
      } catch (error) {
        return serverError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  app.post(`${API_PREFIX}/gitlab/merge-requests/:iid/inline-comments`, async (c) => {
    try {
      const body = (await c.req.json()) as {
        repoPath?: string;
        projectPath?: string;
        url?: string;
        body?: string;
        filePath?: string;
        line?: number;
        positionType?: "new" | "old";
      };
      if (!body.body || !body.filePath || body.line === undefined) {
        return badRequest("Missing inline comment body, filePath, or line.");
      }
      const { baseUrl, token } = await requireGitLabConfig();
      const projectPath = await resolveGitLabProjectPath({
        defaultRepoPath: context.repoPath,
        repoPath: body.repoPath,
        explicitProjectPath: body.projectPath,
        remoteUrl: body.url,
      });
      const iid = parseInteger(c.req.param("iid"), "merge request iid");
      const url = await addInlineMergeRequestComment(
        baseUrl,
        token,
        projectPath,
        iid,
        body.body,
        body.filePath,
        body.line,
        body.positionType ?? "new"
      );
      return c.json({ url });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/github/pull-requests`, async (c) => {
    try {
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const requestedState =
        (c.req.query("state") as "open" | "closed" | "merged" | "all") || "open";
      const state = requestedState === "merged" ? "closed" : requestedState;
      const pullRequests = await listGitHubPullRequests(token, repoPath, state);
      return c.json(
        requestedState === "merged"
          ? pullRequests.filter((pr) => {
              if (typeof pr !== "object" || pr === null) {
                return false;
              }
              const review = pr as { merged_at?: unknown; merged?: unknown };
              return Boolean(review.merged_at) || Boolean(review.merged);
            })
          : pullRequests
      );
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/github/repositories`, async (c) => {
    try {
      const { config, token } = await requireGitHubConfig();
      const configuredUrl = (config.githubUrl || "").replace(/\/+$/, "");
      const apiBaseUrl =
        configuredUrl && !configuredUrl.includes("github.com")
          ? `${configuredUrl}/api/v3`
          : undefined;
      return c.json(await listGitHubRepositories(token, apiBaseUrl));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/github/pull-requests/:number`, async (c) => {
    try {
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const prNumber = parseInteger(c.req.param("number"), "pull request number");
      return c.json(await getGitHubPullRequest(token, repoPath, prNumber));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/github/pull-requests/:number/diffs`, async (c) => {
    try {
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const prNumber = parseInteger(c.req.param("number"), "pull request number");
      return c.json(await getGitHubPullRequestFiles(token, repoPath, prNumber));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/github/pull-requests/:number/commits`, async (c) => {
    try {
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const prNumber = parseInteger(c.req.param("number"), "pull request number");
      return c.json(await getGitHubPullRequestCommits(token, repoPath, prNumber));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/github/pull-requests/:number/discussions`, async (c) => {
    try {
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const prNumber = parseInteger(c.req.param("number"), "pull request number");
      const [issueComments, reviewComments] = await Promise.all([
        listGitHubIssueComments(token, repoPath, prNumber),
        listGitHubReviewComments(token, repoPath, prNumber),
      ]);
      return c.json({ issueComments, reviewComments });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/github/pull-requests/:number/comments`, async (c) => {
    try {
      const body = (await c.req.json()) as { repoPath?: string; remoteUrl?: string; body?: string };
      if (!body.body) {
        return badRequest("Missing comment body.");
      }
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: body.repoPath,
        remoteUrl: body.remoteUrl,
      });
      const prNumber = parseInteger(c.req.param("number"), "pull request number");
      const url = await addGitHubPullRequestComment(token, repoPath, prNumber, body.body);
      return c.json({ url });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.patch(`${API_PREFIX}/github/pull-requests/:number/issue-comments/:commentId`, async (c) => {
    try {
      const body = (await c.req.json()) as { repoPath?: string; remoteUrl?: string; body?: string };
      if (!body.body) {
        return badRequest("Missing comment body.");
      }
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: body.repoPath,
        remoteUrl: body.remoteUrl,
      });
      const commentId = parseInteger(c.req.param("commentId"), "issue comment id");
      const url = await updateGitHubPullRequestComment(token, repoPath, commentId, body.body);
      return c.json({ url });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.delete(`${API_PREFIX}/github/pull-requests/:number/issue-comments/:commentId`, async (c) => {
    try {
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const commentId = parseInteger(c.req.param("commentId"), "issue comment id");
      await deleteGitHubPullRequestComment(token, repoPath, commentId);
      return c.json({ ok: true });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/github/pull-requests/:number/review-comments/:commentId/replies`, async (c) => {
    try {
      const body = (await c.req.json()) as {
        repoPath?: string;
        remoteUrl?: string;
        body?: string;
      };
      if (!body.body) {
        return badRequest("Missing reply body.");
      }
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: body.repoPath,
        remoteUrl: body.remoteUrl,
      });
      const prNumber = parseInteger(c.req.param("number"), "pull request number");
      const commentId = parseInteger(c.req.param("commentId"), "review comment id");
      const url = await replyToGitHubReviewComment(
        token,
        repoPath,
        prNumber,
        commentId,
        body.body
      );
      return c.json({ url });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.patch(`${API_PREFIX}/github/pull-requests/:number/review-comments/:commentId`, async (c) => {
    try {
      const body = (await c.req.json()) as {
        repoPath?: string;
        remoteUrl?: string;
        body?: string;
      };
      if (!body.body) {
        return badRequest("Missing comment body.");
      }
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: body.repoPath,
        remoteUrl: body.remoteUrl,
      });
      const commentId = parseInteger(c.req.param("commentId"), "review comment id");
      const url = await updateGitHubReviewComment(token, repoPath, commentId, body.body);
      return c.json({ url });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.delete(`${API_PREFIX}/github/pull-requests/:number/review-comments/:commentId`, async (c) => {
    try {
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: c.req.query("repoPath") ?? undefined,
        remoteUrl: c.req.query("remoteUrl") ?? undefined,
      });
      const commentId = parseInteger(c.req.param("commentId"), "review comment id");
      await deleteGitHubReviewComment(token, repoPath, commentId);
      return c.json({ ok: true });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/github/pull-requests/:number/inline-comments`, async (c) => {
    try {
      const body = (await c.req.json()) as {
        repoPath?: string;
        remoteUrl?: string;
        body?: string;
        filePath?: string;
        line?: number;
        side?: "LEFT" | "RIGHT";
      };
      if (!body.body || !body.filePath || body.line === undefined) {
        return badRequest("Missing inline comment body, filePath, or line.");
      }
      const { token } = await requireGitHubConfig();
      const repoPath = await resolveGitHubRepoPath({
        defaultRepoPath: context.repoPath,
        repoPath: body.repoPath,
        remoteUrl: body.remoteUrl,
      });
      const prNumber = parseInteger(c.req.param("number"), "pull request number");
      const url = await addGitHubInlinePullRequestComment(
        token,
        repoPath,
        prNumber,
        body.body,
        body.filePath,
        body.line,
        body.side ?? "RIGHT"
      );
      return c.json({ url });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/reviewboard/repositories`, async (c) => {
    try {
      const { baseUrl, token } = await requireReviewBoardConfig();
      return c.json(await listRepositories(baseUrl, token));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/reviewboard/review-requests`, async (c) => {
    try {
      const { baseUrl, token } = await requireReviewBoardConfig();
      const status = (c.req.query("status") as "pending" | "submitted" | "all") || "pending";
      const fromUser = c.req.query("fromUser") ?? undefined;
      const repositoryId = c.req.query("repositoryId");
      return c.json(
        await listReviewRequests(
          baseUrl,
          token,
          status,
          fromUser,
          repositoryId ? parseInteger(repositoryId, "repository id") : undefined
        )
      );
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/reviewboard/review-requests/:id`, async (c) => {
    try {
      const { baseUrl, token } = await requireReviewBoardConfig();
      const requestId = parseInteger(c.req.param("id"), "review request id");
      return c.json(await getReviewRequest(baseUrl, token, requestId));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(`${API_PREFIX}/reviewboard/review-requests/:id/diffs`, async (c) => {
    try {
      const { baseUrl, token } = await requireReviewBoardConfig();
      const requestId = parseInteger(c.req.param("id"), "review request id");
      const explicitDiffSetId = c.req.query("diffSetId");
      const latestDiffSet =
        explicitDiffSetId === undefined
          ? await getLatestDiffSet(baseUrl, token, requestId)
          : { id: parseInteger(explicitDiffSetId, "diff set id") };

      if (!latestDiffSet) {
        return c.json({ diffSet: null, files: [] });
      }

      return c.json({
        diffSet: latestDiffSet,
        files: await getFileDiffs(baseUrl, token, requestId, latestDiffSet.id),
      });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.get(
    `${API_PREFIX}/reviewboard/review-requests/:id/diffs/:diffSetId/files/:fileDiffId`,
    async (c) => {
      try {
        const { baseUrl, token } = await requireReviewBoardConfig();
        const requestId = parseInteger(c.req.param("id"), "review request id");
        const diffSetId = parseInteger(c.req.param("diffSetId"), "diff set id");
        const fileDiffId = parseInteger(c.req.param("fileDiffId"), "file diff id");
        return c.json(await getFileDiffData(baseUrl, token, requestId, diffSetId, fileDiffId));
      } catch (error) {
        return serverError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  app.post(`${API_PREFIX}/reviewboard/review-requests`, async (c) => {
    try {
      const body = (await c.req.json()) as { repositoryId?: number };
      if (body.repositoryId === undefined) {
        return badRequest("Missing repositoryId.");
      }
      const { baseUrl, token } = await requireReviewBoardConfig();
      return c.json(await createReviewRequest(baseUrl, token, body.repositoryId));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.put(`${API_PREFIX}/reviewboard/review-requests/:id`, async (c) => {
    try {
      const body = (await c.req.json()) as { summary?: string; description?: string };
      const { baseUrl, token } = await requireReviewBoardConfig();
      const requestId = parseInteger(c.req.param("id"), "review request id");
      return c.json(await updateReviewRequestDraft(baseUrl, token, requestId, body));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/reviewboard/review-requests/:id/diffs`, async (c) => {
    try {
      const body = (await c.req.json()) as { diff?: string; basedir?: string };
      if (!body.diff) {
        return badRequest("Missing diff.");
      }
      const { baseUrl, token } = await requireReviewBoardConfig();
      const requestId = parseInteger(c.req.param("id"), "review request id");
      return c.json(
        await uploadReviewRequestDiff(baseUrl, token, requestId, body.diff, body.basedir)
      );
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/reviewboard/review-requests/:id/publish`, async (c) => {
    try {
      const { baseUrl, token } = await requireReviewBoardConfig();
      const requestId = parseInteger(c.req.param("id"), "review request id");
      return c.json(await publishReviewRequest(baseUrl, token, requestId));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(`${API_PREFIX}/reviewboard/review-requests/:id/reviews`, async (c) => {
    try {
      const body = (await c.req.json()) as { bodyTop?: string };
      if (body.bodyTop === undefined) {
        return badRequest("Missing bodyTop.");
      }
      const { baseUrl, token } = await requireReviewBoardConfig();
      const requestId = parseInteger(c.req.param("id"), "review request id");
      return c.json(await createReview(baseUrl, token, requestId, body.bodyTop));
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  app.post(
    `${API_PREFIX}/reviewboard/review-requests/:id/reviews/:reviewId/diff-comments`,
    async (c) => {
      try {
        const body = (await c.req.json()) as {
          fileDiffId?: number;
          firstLine?: number;
          numLines?: number;
          text?: string;
        };
        if (
          body.fileDiffId === undefined ||
          body.firstLine === undefined ||
          body.numLines === undefined ||
          !body.text
        ) {
          return badRequest("Missing fileDiffId, firstLine, numLines, or text.");
        }
        const { baseUrl, token } = await requireReviewBoardConfig();
        const requestId = parseInteger(c.req.param("id"), "review request id");
        const reviewId = parseInteger(c.req.param("reviewId"), "review id");
        await addDiffComment(
          baseUrl,
          token,
          requestId,
          reviewId,
          body.fileDiffId,
          body.firstLine,
          body.numLines,
          body.text
        );
        return c.json({ status: "ok" });
      } catch (error) {
        return serverError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  app.post(`${API_PREFIX}/reviewboard/review-requests/:id/reviews/:reviewId/publish`, async (c) => {
    try {
      const { baseUrl, token } = await requireReviewBoardConfig();
      const requestId = parseInteger(c.req.param("id"), "review request id");
      const reviewId = parseInteger(c.req.param("reviewId"), "review id");
      await publishReview(baseUrl, token, requestId, reviewId);
      return c.json({ status: "ok" });
    } catch (error) {
      return serverError(error instanceof Error ? error.message : String(error));
    }
  });

  return app;
}
