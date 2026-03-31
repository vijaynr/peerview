import { createGitHubClient, type GitHubClient } from "../clients/githubClient.js";
import { createGitLabClient, type GitLabClient } from "../clients/gitlabClient.js";
import { createLlmClient, type LlmClient } from "../clients/llmClient.js";
import { createReviewBoardClient, type ReviewBoardClient } from "../clients/reviewBoardClient.js";
import { createSvnClient, type SvnClient } from "../clients/svnClient.js";
import { envOrConfig, envOrConfigBoolean, loadPVConfig } from "./config.js";
import { logger } from "./logger.js";

export type WorkflowRuntime = {
  gitlabUrl: string;
  gitlabKey: string;
  githubToken: string;
  svnRepositoryUrl: string;
  svnUsername: string;
  svnPassword: string;
  rbUrl: string;
  rbToken: string;
  gitlabWebhookSecret?: string;
  githubWebhookSecret?: string;
  rbWebhookSecret?: string;
  gitlabWebhookEnabled: boolean;
  githubWebhookEnabled: boolean;
  reviewboardWebhookEnabled: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;
  sslCaPath?: string;
  webhookConcurrency: number;
  webhookQueueLimit: number;
  webhookJobTimeoutMs: number;
  openaiApiUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  useCustomStreaming: boolean;
  defaultReviewAgents: string[];
};

export async function loadWorkflowRuntime(): Promise<WorkflowRuntime> {
  const config = await loadPVConfig();

  const envCustomStreaming = process.env.USE_CUSTOM_STREAMING;
  const useCustomStreaming =
    envCustomStreaming !== undefined
      ? envCustomStreaming.toLowerCase() === "true"
      : (config.useCustomStreaming ?? false);

  const runtime: WorkflowRuntime = {
    gitlabUrl: envOrConfig("GITLAB_URL", config.gitlabUrl, ""),
    gitlabKey: envOrConfig("GITLAB_KEY", config.gitlabKey, ""),
    githubToken: envOrConfig("GITHUB_TOKEN", config.githubToken, ""),
    svnRepositoryUrl:
      process.env.SVN_REPOSITORY_URL ||
      process.env.SVN_GUIDELINES_BASE_URL ||
      config.svnRepositoryUrl ||
      "",
    svnUsername: envOrConfig("SVN_USERNAME", config.svnUsername, ""),
    svnPassword: envOrConfig("SVN_PASSWORD", config.svnPassword, ""),
    rbUrl: envOrConfig("RB_URL", config.rbUrl, ""),
    rbToken: envOrConfig("RB_TOKEN", config.rbToken, ""),
    gitlabWebhookSecret: envOrConfig("GITLAB_WEBHOOK_SECRET", config.gitlabWebhookSecret, ""),
    githubWebhookSecret: envOrConfig("GITHUB_WEBHOOK_SECRET", config.githubWebhookSecret, ""),
    rbWebhookSecret: envOrConfig("RB_WEBHOOK_SECRET", config.rbWebhookSecret, ""),
    gitlabWebhookEnabled: envOrConfigBoolean(
      "GITLAB_WEBHOOK_ENABLED",
      config.gitlabWebhookEnabled,
      true
    ),
    githubWebhookEnabled: envOrConfigBoolean(
      "GITHUB_WEBHOOK_ENABLED",
      config.githubWebhookEnabled,
      true
    ),
    reviewboardWebhookEnabled: envOrConfigBoolean(
      "REVIEWBOARD_WEBHOOK_ENABLED",
      config.reviewboardWebhookEnabled,
      true
    ),
    sslCertPath: envOrConfig("SSL_CERT_PATH", config.sslCertPath, ""),
    sslKeyPath: envOrConfig("SSL_KEY_PATH", config.sslKeyPath, ""),
    sslCaPath: envOrConfig("SSL_CA_PATH", config.sslCaPath, ""),
    webhookConcurrency: Number.parseInt(
      envOrConfig("WEBHOOK_CONCURRENCY", config.webhookConcurrency?.toString(), "3"),
      10
    ),
    webhookQueueLimit: Number.parseInt(
      envOrConfig("WEBHOOK_QUEUE_LIMIT", config.webhookQueueLimit?.toString(), "50"),
      10
    ),
    webhookJobTimeoutMs: Number.parseInt(
      envOrConfig("WEBHOOK_JOB_TIMEOUT_MS", config.webhookJobTimeoutMs?.toString(), "600000"),
      10
    ),
    openaiApiUrl: envOrConfig("OPENAI_API_URL", config.openaiApiUrl, ""),
    openaiApiKey: envOrConfig("OPENAI_API_KEY", config.openaiApiKey, ""),
    openaiModel: envOrConfig("OPENAI_MODEL", config.openaiModel, "gpt-4o"),
    useCustomStreaming,
    defaultReviewAgents: config.defaultReviewAgents?.length
      ? config.defaultReviewAgents
      : ["general"],
  };

  logger.debug("runtime", "workflow runtime loaded", {
    gitlabUrl: runtime.gitlabUrl,
    gitlabKey: runtime.gitlabKey ? "***" : "(not set)",
    svnRepositoryUrl: runtime.svnRepositoryUrl,
    svnUsername: runtime.svnUsername ? "***" : "(not set)",
    svnPassword: runtime.svnPassword ? "***" : "(not set)",
    rbUrl: runtime.rbUrl,
    rbToken: runtime.rbToken ? "***" : "(not set)",
    gitlabWebhookSecret: runtime.gitlabWebhookSecret ? "***" : "(not set)",
    gitlabWebhookEnabled: runtime.gitlabWebhookEnabled,
    githubWebhookSecret: runtime.githubWebhookSecret ? "***" : "(not set)",
    githubWebhookEnabled: runtime.githubWebhookEnabled,
    rbWebhookSecret: runtime.rbWebhookSecret ? "***" : "(not set)",
    reviewboardWebhookEnabled: runtime.reviewboardWebhookEnabled,
    openaiApiUrl: runtime.openaiApiUrl,
    openaiApiKey: runtime.openaiApiKey ? "***" : "(not set)",
    openaiModel: runtime.openaiModel,
    useCustomStreaming: runtime.useCustomStreaming,
    defaultReviewAgents: runtime.defaultReviewAgents,
  });

  return runtime;
}

export function createRuntimeLlmClient(runtime: WorkflowRuntime): LlmClient {
  return createLlmClient({
    apiKey: runtime.openaiApiKey,
    apiUrl: runtime.openaiApiUrl,
    model: runtime.openaiModel,
    useCustomStreaming: runtime.useCustomStreaming,
  });
}

export function createRuntimeGitLabClient(runtime: WorkflowRuntime): GitLabClient {
  return createGitLabClient(runtime.gitlabUrl, runtime.gitlabKey);
}

export function createRuntimeGitHubClient(runtime: WorkflowRuntime): GitHubClient {
  return createGitHubClient(runtime.githubToken);
}

export function createRuntimeSvnClient(runtime: WorkflowRuntime): SvnClient | null {
  if (!runtime.svnRepositoryUrl) {
    return null;
  }

  return createSvnClient(
    runtime.svnRepositoryUrl,
    runtime.svnUsername || undefined,
    runtime.svnPassword || undefined
  );
}

export function createRuntimeReviewBoardClient(runtime: WorkflowRuntime): ReviewBoardClient {
  return createReviewBoardClient(runtime.rbUrl, runtime.rbToken);
}
