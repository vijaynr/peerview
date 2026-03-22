export type CRConfig = {
  openaiApiUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  useCustomStreaming: boolean; // Use custom SSE streaming instead of standard OpenAI SDK
  defaultReviewAgents?: string[];
  gitlabUrl: string;
  gitlabKey: string;
  githubUrl?: string;
  githubToken?: string;
  svnRepositoryUrl?: string;
  svnUsername?: string;
  svnPassword?: string;
  rbUrl?: string;
  rbToken?: string;
  gitlabWebhookSecret?: string;
  githubWebhookSecret?: string;
  rbWebhookSecret?: string;
  sslCertPath?: string;
  sslKeyPath?: string;
  sslCaPath?: string;
  webhookConcurrency?: number;
  webhookQueueLimit?: number;
  webhookJobTimeoutMs?: number;
  terminalTheme?: "auto" | "dark" | "light"; // Optional theme override
  gitlabEnabled?: boolean;
  githubEnabled?: boolean;
  reviewboardEnabled?: boolean;
  gitlabWebhookEnabled?: boolean;
  githubWebhookEnabled?: boolean;
  reviewboardWebhookEnabled?: boolean;
};

export const defaultConfig: Pick<CRConfig, "openaiApiUrl" | "openaiModel" | "gitlabUrl" | "rbUrl"> =
  {
    openaiApiUrl: "https://api.example.com/v1",
    openaiModel: "llama-3.3-70b",
    gitlabUrl: "https://gitlab.example.com",
    rbUrl: "https://reviews.example.com",
  };
