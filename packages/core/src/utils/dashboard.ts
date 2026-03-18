import type { DashboardData, DashboardProviderData } from "../types/web.js";
import { envOrConfig, loadCRConfig } from "./config.js";
import { getOriginRemoteUrl } from "./git.js";
import { isGitHubRemote, listGitHubPullRequests, looksLikeConfiguredGitHub, remoteToGitHubRepoPath } from "./github.js";
import { listMergeRequests, remoteToProjectPath } from "./gitlab.js";
import {
  getCurrentUser as rbGetCurrentUser,
  listReviewRequests as rbListRequests,
  rbRequest,
} from "./reviewBoard.js";

function looksLikeConfiguredGitLab(remoteUrl: string, gitlabUrl: string): boolean {
  if (remoteUrl.toLowerCase().includes("gitlab")) {
    return true;
  }

  if (!gitlabUrl) {
    return false;
  }

  try {
    return remoteUrl.includes(new URL(gitlabUrl).hostname);
  } catch {
    return false;
  }
}

async function loadRepositorySummary(args: {
  repoPath?: string;
  remoteUrl?: string;
}): Promise<DashboardData["repository"]> {
  if (args.remoteUrl) {
    return {
      remoteUrl: args.remoteUrl,
      source: "remote",
    };
  }

  if (!args.repoPath) {
    return {
      source: "none",
    };
  }

  try {
    const remoteUrl = await getOriginRemoteUrl(args.repoPath);
    return { cwd: args.repoPath, remoteUrl, source: "local" };
  } catch {
    return { cwd: args.repoPath, source: "local" };
  }
}

async function loadGitLabDashboardProvider(args: {
  remoteUrl?: string;
  gitlabUrl: string;
  gitlabKey: string;
}): Promise<DashboardProviderData> {
  const { gitlabKey, gitlabUrl, remoteUrl } = args;
  if (!gitlabUrl || !gitlabKey) {
    return {
      provider: "gitlab",
      configured: false,
      items: [],
      error: "Missing GitLab configuration.",
    };
  }

  if (!remoteUrl) {
    return {
      provider: "gitlab",
      configured: true,
      items: [],
      error: "No git remote detected for the current directory.",
    };
  }

  if (!looksLikeConfiguredGitLab(remoteUrl, gitlabUrl)) {
    return {
      provider: "gitlab",
      configured: true,
      items: [],
      error: "Current repository remote does not look like GitLab.",
    };
  }

  try {
    const projectPath = remoteToProjectPath(remoteUrl);
    const mergeRequests = await listMergeRequests(gitlabUrl, gitlabKey, projectPath, "opened");

    return {
      provider: "gitlab",
      configured: true,
      repository: projectPath,
      items: mergeRequests.map((mr) => ({
        provider: "gitlab",
        id: mr.iid,
        title: mr.title,
        url: mr.web_url,
        state: mr.state,
        author: mr.author?.username ?? mr.author?.name,
        updatedAt: mr.updated_at,
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,
      })),
    };
  } catch (error) {
    return {
      provider: "gitlab",
      configured: true,
      items: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function loadGitHubDashboardProvider(args: {
  remoteUrl?: string;
  githubUrl: string;
  githubToken: string;
}): Promise<DashboardProviderData> {
  const { githubToken, githubUrl, remoteUrl } = args;
  if (!githubToken) {
    return {
      provider: "github",
      configured: false,
      items: [],
      error: "Missing GitHub configuration.",
    };
  }

  if (!remoteUrl) {
    return {
      provider: "github",
      configured: true,
      items: [],
      error: "No git remote detected for the current directory.",
    };
  }

  if (!looksLikeConfiguredGitHub(remoteUrl, githubUrl)) {
    return {
      provider: "github",
      configured: true,
      items: [],
      error: "Current repository remote does not look like GitHub.",
    };
  }

  // Derive GHE API base URL: GitHub Enterprise Server exposes its REST API at /api/v3
  const apiBaseUrl = githubUrl && !isGitHubRemote(remoteUrl)
    ? `${githubUrl.replace(/\/+$/, "")}/api/v3`
    : undefined;

  try {
    const repo = remoteToGitHubRepoPath(remoteUrl);
    const pullRequests = await listGitHubPullRequests(githubToken, repo, "open", apiBaseUrl);

    return {
      provider: "github",
      configured: true,
      repository: repo,
      items: pullRequests.map((pr) => ({
        provider: "github",
        id: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.state,
        author: pr.user?.login,
        updatedAt: pr.updated_at,
        sourceBranch: pr.head?.ref,
        targetBranch: pr.base?.ref,
        draft: pr.draft,
      })),
    };
  } catch (error) {
    return {
      provider: "github",
      configured: true,
      items: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function loadReviewBoardDashboardProvider(args: {
  rbUrl: string;
  rbToken: string;
}): Promise<DashboardProviderData> {
  const { rbToken, rbUrl } = args;
  if (!rbUrl || !rbToken) {
    return {
      provider: "reviewboard",
      configured: false,
      items: [],
      error: "Missing Review Board configuration.",
    };
  }

  try {
    let requests = await rbListRequests(rbUrl, rbToken, "pending");

    if (requests.length === 0) {
      const user = await rbGetCurrentUser(rbUrl, rbToken);
      const outgoing = await rbListRequests(rbUrl, rbToken, "pending", user.username);

      const incomingDirect = await rbRequest<{ review_requests?: Array<Record<string, unknown>> }>(
        rbUrl,
        rbToken,
        `/api/review-requests/?status=pending&to-users-directly=${encodeURIComponent(user.username)}&expand=submitter`
      );

      const incomingGroups = await rbRequest<{ review_requests?: Array<Record<string, unknown>> }>(
        rbUrl,
        rbToken,
        `/api/review-requests/?status=pending&to-users=${encodeURIComponent(user.username)}&expand=submitter`
      );

      const seenIds = new Set<number>();
      requests = [
        ...outgoing,
        ...((incomingDirect.review_requests ?? []) as typeof requests),
        ...((incomingGroups.review_requests ?? []) as typeof requests),
      ].filter((request) => {
        if (seenIds.has(request.id)) {
          return false;
        }
        seenIds.add(request.id);
        return true;
      });
    }

    return {
      provider: "reviewboard",
      configured: true,
      items: requests.map((request) => ({
        provider: "reviewboard",
        id: request.id,
        title: request.summary,
        url: request.absolute_url,
        state: request.status,
        author: request.submitter?.username,
        repository: request.repository?.name,
      })),
    };
  } catch (error) {
    return {
      provider: "reviewboard",
      configured: true,
      items: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function loadDashboardData(
  args: { repoPath?: string; remoteUrl?: string } = {}
): Promise<DashboardData> {
  const config = await loadCRConfig();
  const repository = await loadRepositorySummary(args);

  const gitlabUrl = envOrConfig("GITLAB_URL", config.gitlabUrl, "");
  const gitlabKey = envOrConfig("GITLAB_KEY", config.gitlabKey, "");
  const githubUrl = envOrConfig("GITHUB_URL", config.githubUrl, "");
  const githubToken = envOrConfig("GITHUB_TOKEN", config.githubToken, "");
  const rbUrl = envOrConfig("RB_URL", config.rbUrl, "");
  const rbToken = envOrConfig("RB_TOKEN", config.rbToken, "");
  const openaiApiUrl = envOrConfig("OPENAI_API_URL", config.openaiApiUrl, "");
  const openaiApiKey = envOrConfig("OPENAI_API_KEY", config.openaiApiKey, "");
  const openaiModel = envOrConfig("OPENAI_MODEL", config.openaiModel, "");
  const sslCertPath = envOrConfig("SSL_CERT_PATH", config.sslCertPath, "");
  const sslKeyPath = envOrConfig("SSL_KEY_PATH", config.sslKeyPath, "");
  const webhookConcurrency = Number.parseInt(
    envOrConfig("WEBHOOK_CONCURRENCY", config.webhookConcurrency?.toString(), "3"),
    10
  );
  const webhookQueueLimit = Number.parseInt(
    envOrConfig("WEBHOOK_QUEUE_LIMIT", config.webhookQueueLimit?.toString(), "50"),
    10
  );
  const webhookJobTimeoutMs = Number.parseInt(
    envOrConfig("WEBHOOK_JOB_TIMEOUT_MS", config.webhookJobTimeoutMs?.toString(), "600000"),
    10
  );

  const [gitlab, github, reviewboard] = await Promise.all([
    config.gitlabEnabled === false
      ? Promise.resolve<DashboardProviderData>({ provider: "gitlab", configured: false, items: [], error: "GitLab is disabled." })
      : loadGitLabDashboardProvider({
          remoteUrl: repository.remoteUrl,
          gitlabUrl,
          gitlabKey,
        }),
    config.githubEnabled === false
      ? Promise.resolve<DashboardProviderData>({ provider: "github", configured: false, items: [], error: "GitHub is disabled." })
      : loadGitHubDashboardProvider({
          remoteUrl: repository.remoteUrl,
          githubUrl,
          githubToken,
        }),
    config.reviewboardEnabled === false
      ? Promise.resolve<DashboardProviderData>({ provider: "reviewboard", configured: false, items: [], error: "Review Board is disabled." })
      : loadReviewBoardDashboardProvider({
          rbUrl,
          rbToken,
        }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    repository,
    config: {
      openai: {
        configured: Boolean(openaiApiKey),
        apiUrl: openaiApiUrl || undefined,
        model: openaiModel || undefined,
      },
      gitlab: {
        configured: Boolean(gitlabUrl && gitlabKey),
        url: gitlabUrl || undefined,
      },
      github: {
        configured: Boolean(githubToken),
        url: githubUrl || "https://github.com",
      },
      reviewboard: {
        configured: Boolean(rbUrl && rbToken),
        url: rbUrl || undefined,
      },
      webhook: {
        sslEnabled: Boolean(sslCertPath && sslKeyPath),
        concurrency: webhookConcurrency,
        queueLimit: webhookQueueLimit,
        jobTimeoutMs: webhookJobTimeoutMs,
      },
      defaultReviewAgents: config.defaultReviewAgents?.length
        ? config.defaultReviewAgents
        : ["general"],
    },
    providers: {
      gitlab,
      github,
      reviewboard,
    },
  };
}
