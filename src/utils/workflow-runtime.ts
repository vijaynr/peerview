import { createGitLabClient, type GitLabClient } from "../clients/gitlab-client.js";
import { createLlmClient, type LlmClient } from "../clients/llm-client.js";
import { envOrConfig, loadCRConfig } from "./config.js";

export type WorkflowRuntime = {
  gitlabUrl: string;
  gitlabKey: string;
  openaiApiUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  useCustomStreaming: boolean;
};

export async function loadWorkflowRuntime(): Promise<WorkflowRuntime> {
  const config = await loadCRConfig();

  // Parse boolean from environment variable
  const envCustomStreaming = process.env.USE_CUSTOM_STREAMING;
  const useCustomStreaming =
    envCustomStreaming !== undefined
      ? envCustomStreaming.toLowerCase() === "true"
      : (config.useCustomStreaming ?? false);

  return {
    gitlabUrl: envOrConfig("GITLAB_URL", config.gitlabUrl, ""),
    gitlabKey: envOrConfig("GITLAB_KEY", config.gitlabKey, ""),
    openaiApiUrl: envOrConfig("OPENAI_API_URL", config.openaiApiUrl, ""),
    openaiApiKey: envOrConfig("OPENAI_API_KEY", config.openaiApiKey, ""),
    openaiModel: envOrConfig("OPENAI_MODEL", config.openaiModel, "gpt-4o"),
    useCustomStreaming,
  };
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
