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
  | "chat_context_summary"
  | "answering_question";
export type CreateMrPhase =
  | "load_remote_branches"
  | "get_branch_diff"
  | "generate_mr_draft"
  | "upsert_merge_request";
export type WorkflowEventType = "phase_started" | "phase_completed";
export type WorkflowName = "review" | "reviewSummarize" | "reviewChat" | "createMr";
export type WorkflowPhaseMap = {
  review: ReviewPhase;
  reviewSummarize: ReviewPhase;
  reviewChat: ReviewPhase;
  createMr: CreateMrPhase;
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
  provider?: "gitlab" | "reviewboard";
  url?: string;
  fromUser?: string;
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
  rbUrl?: string;
  guidelines?: string;
};

export type ReviewWorkflowEffect =
  | {
      type: "review_ready";
      result: ReviewWorkflowResult;
    }
  | {
      type: "request_review_feedback";
      result: ReviewWorkflowResult;
    };

export type ReviewWorkflowResponse = {
  type: "review_feedback";
  feedback: string | null;
};

export type ReviewSelectionOption = {
  title: string;
  value: number;
};

export type ReviewSessionEffect =
  | ReviewWorkflowEffect
  | {
      type: "select_review_target";
      provider: "gitlab" | "reviewboard";
      message: string;
      options: ReviewSelectionOption[];
    }
  | {
      type: "confirm_review_start";
      message: string;
    };

export type ReviewSessionResponse =
  | ReviewWorkflowResponse
  | {
      type: "review_target_selected";
      mrIid: number | null;
    }
  | {
      type: "review_action_confirmed";
      confirmed: boolean;
    };

export type ReviewSessionResult =
  | {
      action: "cancelled";
      message: string;
    }
  | {
      action: "review";
      result: ReviewWorkflowResult;
    }
  | {
      action: "summary";
      result: ReviewWorkflowResult;
    }
  | {
      action: "chat";
      context: ReviewChatContext;
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
};

export type CreateMrWorkflowEffect =
  | {
      type: "draft_ready";
      draft: CreateMrDraft;
    }
  | {
      type: "resolve_target_branch";
      branches: string[];
      defaultBranch: string;
    }
  | {
      type: "request_draft_feedback";
      draft: CreateMrDraft;
    }
  | {
      type: "confirm_upsert";
      draft: CreateMrDraft;
      existingMrIid?: number;
    };

export type CreateMrWorkflowResponse =
  | {
      type: "target_branch_resolved";
      targetBranch: string;
    }
  | {
      type: "draft_feedback";
      feedback: string | null;
    }
  | {
      type: "upsert_confirmed";
      shouldProceed: boolean;
    };

export type CreateMrWorkflowResult = {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  mergeRequestUrl?: string;
  action: "created" | "updated" | "cancelled";
};
