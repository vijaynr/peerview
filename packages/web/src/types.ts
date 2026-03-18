export type ProviderId = "gitlab" | "github" | "reviewboard";
export type ReviewState = "opened" | "closed" | "merged" | "all";
export type DashboardSection = "overview" | ProviderId | "settings";
export type TerminalTheme = "auto" | "dark" | "light";
export type RepositorySourceMode = "local" | "remote";

export type RepositoryContext = {
  mode: RepositorySourceMode;
  repoPath?: string;
  remoteUrl?: string;
};

export type DashboardRequest = {
  id: number | string;
  title: string;
  url: string;
  state?: string;
  draft?: boolean;
  author?: string;
  sourceBranch?: string;
  targetBranch?: string;
  repository?: string;
  updatedAt?: string;
};

export type ProviderDashboard = {
  configured: boolean;
  repository?: string;
  error?: string;
  items: DashboardRequest[];
};

export type DashboardData = {
  generatedAt?: string;
  repository: {
    cwd?: string;
    remoteUrl?: string;
    source?: "local" | "remote" | "none";
  };
  config: {
    openai: {
      configured?: boolean;
      model?: string;
      apiUrl?: string;
    };
    gitlab?: {
      configured?: boolean;
      url?: string;
    };
    github?: {
      configured?: boolean;
      url?: string;
    };
    reviewboard?: {
      configured?: boolean;
      url?: string;
    };
    defaultReviewAgents: string[];
    webhook: {
      sslEnabled?: boolean;
      concurrency: number;
      queueLimit: number;
      jobTimeoutMs?: number;
    };
  };
  providers: Record<ProviderId, ProviderDashboard>;
};

export type ReviewAgentOption = {
  title: string;
  value: string;
  description?: string;
  selected?: boolean;
};

export type ReviewWorkflowResult = {
  output: string;
  contextLabel: string;
  overallSummary?: string;
  selectedAgents: string[];
  aggregated: boolean;
  agentResults?: Array<{
    name: string;
    output: string;
    overallSummary?: string;
    failed?: boolean;
    error?: string;
  }>;
  inlineComments: Array<{
    filePath: string;
    line: number;
    positionType: "new" | "old";
    comment: string;
  }>;
  mrIid?: number;
  prNumber?: number;
  projectPath?: string;
  repoPath?: string;
  gitlabUrl?: string;
  githubUrl?: string;
  rbUrl?: string;
  guidelines?: string;
};

export type ReviewChatHistoryEntry = {
  question: string;
  answer: string;
};

export type ReviewChatContext = {
  contextLabel: string;
  mrContent: string;
  mrChanges: string;
  mrCommits: string;
  summary: string;
};

export type ReviewRunResponse = {
  result: ReviewWorkflowResult;
  warnings: string[];
};

export type ReviewSummaryResponse = {
  result: ReviewWorkflowResult;
};

export type ReviewChatContextResponse = {
  context: ReviewChatContext;
};

export type ReviewPostResponse = {
  posted: {
    summaryNoteId?: string;
    inlineNoteIds: string[];
  };
};

export type ReviewTarget = {
  provider: ProviderId;
  id: number;
  title: string;
  url?: string;
  state?: string;
  draft?: boolean;
  author?: string;
  repository?: string;
  sourceBranch?: string;
  targetBranch?: string;
  updatedAt?: string;
  description?: string;
  summary?: string;
  raw?: Record<string, unknown>;
};

export type ReviewCommit = {
  id: string;
  title: string;
  author?: string;
  createdAt?: string;
  raw?: Record<string, unknown>;
};

export type ReviewDiffFile = {
  id: string;
  path: string;
  oldPath?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  patch?: string;
  diffSetId?: number;
  fileDiffId?: number;
  raw?: Record<string, unknown>;
};

export type CRConfigRecord = {
  openaiApiUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  useCustomStreaming?: boolean;
  defaultReviewAgents?: string[];
  gitlabUrl?: string;
  gitlabKey?: string;
  githubUrl?: string;
  githubToken?: string;
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
  terminalTheme?: TerminalTheme;
  gitlabEnabled?: boolean;
  githubEnabled?: boolean;
  reviewboardEnabled?: boolean;
};

export type ParsedDiffLine = {
  kind: "header" | "context" | "add" | "remove";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  commentable: boolean;
  positionType?: "old" | "new";
};

export const providerOrder: ProviderId[] = ["gitlab", "github", "reviewboard"];
export const reviewStates: ReviewState[] = ["opened", "closed", "merged", "all"];
export const providerLabels: Record<ProviderId, string> = {
  gitlab: "GitLab",
  github: "GitHub",
  reviewboard: "Review Board",
};
