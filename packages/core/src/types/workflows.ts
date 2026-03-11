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
export type CreateReviewPhase =
  | "load_remote_branches"
  | "get_branch_diff"
  | "generate_mr_draft"
  | "resolve_reviewboard_repository"
  | "create_review_request"
  | "upload_review_diff"
  | "publish_review_request"
  | "upsert_merge_request";
export type WorkflowEventType = "phase_started" | "phase_completed";
export type WorkflowName = "review" | "reviewSummarize" | "reviewChat" | "createReview";
export type WorkflowPhaseMap = {
  review: ReviewPhase;
  reviewSummarize: ReviewPhase;
  reviewChat: ReviewPhase;
  createReview: CreateReviewPhase;
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

export type CreateReviewProvider = "gitlab" | "reviewboard";

export type CreateReviewDraft = {
  provider: CreateReviewProvider;
  sourceLabel: string;
  targetLabel?: string;
  title: string;
  description: string;
  iteration: number;
};

export type CreateReviewWorkflowInput = {
  repoPath: string;
  targetBranch?: string;
  provider?: CreateReviewProvider;
  mode: WorkflowMode;
  repoRoot: string;
  userFeedback?: string;
  shouldProceed?: boolean;
  status?: StatusReporter;
  events?: WorkflowEventReporter;
};

export type CreateReviewWorkflowEffect =
  | {
      type: "draft_ready";
      draft: CreateReviewDraft;
    }
  | {
      type: "resolve_target_branch";
      branches: string[];
      defaultBranch: string;
    }
  | {
      type: "request_draft_feedback";
      draft: CreateReviewDraft;
    }
  | {
      type: "confirm_upsert";
      draft: CreateReviewDraft;
      entityType: "merge_request" | "review_request";
      existingEntityId?: number;
    };

export type CreateReviewWorkflowResponse =
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

export type CreateReviewWorkflowResult = {
  provider: CreateReviewProvider;
  entityType: "merge_request" | "review_request";
  entityId?: number;
  sourceLabel: string;
  targetLabel?: string;
  title: string;
  description: string;
  url?: string;
  action: "created" | "updated" | "cancelled";
};

export type CreateMrDraft = CreateReviewDraft;
export type CreateMrWorkflowInput = CreateReviewWorkflowInput;
export type CreateMrWorkflowEffect = CreateReviewWorkflowEffect;
export type CreateMrWorkflowResponse = CreateReviewWorkflowResponse;
export type CreateMrWorkflowResult = CreateReviewWorkflowResult;
