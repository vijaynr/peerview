export type WorkflowKind = "review" | "summarize" | "chat";
export type WorkflowMode = "interactive" | "ci";
export type MergeRequestState = "opened" | "closed" | "merged" | "all";
export type StatusLevel = "info" | "success" | "warning" | "error";
export type ReviewPhase =
  | "load_mr_context"
  | "generate_review"
  | "generate_summary"
  | "local_review"
  | "local_summary"
  | "chat_context_summary";
export type CreateMrPhase =
  | "load_remote_branches"
  | "get_branch_diff"
  | "generate_mr_draft"
  | "upsert_merge_request";
export type WorkflowEventType = "phase_started" | "phase_completed";
export type WorkflowName = "review" | "create_mr";
export type WorkflowPhaseMap = {
  review: ReviewPhase;
  create_mr: CreateMrPhase;
};

export type StatusReporter = Record<StatusLevel, (message: string) => void>;
export type WorkflowUiEvent<K extends WorkflowName = WorkflowName> = {
  workflow: K;
  type: WorkflowEventType;
  phase: WorkflowPhaseMap[K];
  message: string;
};
export type WorkflowEventReporter = {
  emit: (event: WorkflowUiEvent) => void;
};

export type ReviewWorkflowInput = {
  repoPath: string;
  repoRoot: string;
  mode: WorkflowMode;
  workflow: WorkflowKind;
  local: boolean;
  url?: string;
  state: MergeRequestState;
  mrIid?: number;
  stdinDiff?: string;
  inlineComments?: boolean;
  userFeedback?: string;
  status?: StatusReporter;
  events?: WorkflowEventReporter;
};

export type ReviewWorkflowResult = {
  output: string;
  contextLabel: string;
  overallSummary?: string;
  inlineComments: Array<{
    filePath: string;
    line: number;
    positionType: "new" | "old";
    comment: string;
  }>;
  mrIid?: number;
  projectPath?: string;
  gitlabUrl?: string;
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

export type CreateMrDraft = {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  iteration: number;
};

export type CreateMrWorkflowInput = {
  repoPath: string;
  targetBranch?: string;
  mode: WorkflowMode;
  repoRoot: string;
  userFeedback?: string;
  shouldProceed?: boolean;
  status?: StatusReporter;
  events?: WorkflowEventReporter;
  onDraft?: (draft: CreateMrDraft) => void | Promise<void>;
  resolveTargetBranch?: (args: { branches: string[]; defaultBranch: string }) => Promise<string>;
  requestDraftFeedback?: () => Promise<string | null>;
  confirmUpsert?: (args: { existingMrIid?: number }) => Promise<boolean>;
};

export type CreateMrWorkflowResult = {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  mergeRequestUrl?: string;
  action: "created" | "updated" | "cancelled";
};
