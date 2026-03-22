export type DashboardProviderName = "gitlab" | "github" | "reviewboard";

export type DashboardConfigProviderSummary = {
  configured: boolean;
  url?: string;
};

export type DashboardConfigSummary = {
  openai: {
    configured: boolean;
    apiUrl?: string;
    model?: string;
  };
  gitlab: DashboardConfigProviderSummary;
  github: DashboardConfigProviderSummary;
  reviewboard: DashboardConfigProviderSummary;
  webhook: {
    sslEnabled: boolean;
    concurrency: number;
    queueLimit: number;
    jobTimeoutMs: number;
    providers: Record<DashboardProviderName, { enabled: boolean }>;
  };
  defaultReviewAgents: string[];
};

export type DashboardRepositorySummary = {
  cwd?: string;
  remoteUrl?: string;
  source?: "local" | "remote" | "none";
};

export type DashboardReviewRequest = {
  provider: DashboardProviderName;
  id: number;
  title: string;
  url: string;
  state: string;
  author?: string;
  updatedAt?: string;
  sourceBranch?: string;
  targetBranch?: string;
  repository?: string;
  draft?: boolean;
};

export type DashboardProviderData = {
  provider: DashboardProviderName;
  configured: boolean;
  items: DashboardReviewRequest[];
  error?: string;
  repository?: string;
};

export type DashboardData = {
  generatedAt: string;
  repository: DashboardRepositorySummary;
  config: DashboardConfigSummary;
  providers: Record<DashboardProviderName, DashboardProviderData>;
};
