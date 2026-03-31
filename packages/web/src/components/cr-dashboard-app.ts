import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Menu } from "lucide";
import {
  answerChatQuestion,
  deleteReviewDiscussionMessage,
  loadChatContext,
  loadConfig,
  loadDashboard,
  loadProviderRepositories,
  loadReviewDiscussions,
  loadReviewAgents,
  loadReviewBoardFilePatch,
  loadReviewCommits,
  loadReviewDetail,
  loadReviewDiffs,
  loadReviewTargets,
  postGeneratedReview,
  postInlineComment,
  postSummaryComment,
  replyToReviewDiscussion,
  runReview,
  runSummary,
  saveConfig,
  testConnection,
  updateReviewDiscussionMessage,
  type TestConnectionResult,
} from "../api.js";
import {
  providerLabels,
  providerOrder,
  type CRConfigRecord,
  type DashboardData,
  type DashboardSection,
  type ProviderId,
  type ProviderRepositoryOption,
  type RepositoryContext,
  type ReviewAgentOption,
  type ReviewChatContext,
  type ReviewChatHistoryEntry,
  type ReviewCommit,
  type ReviewDiscussionThread,
  type ReviewDiffFile,
  type ReviewState,
  type ReviewTarget,
  type ReviewWorkflowResult,
  type TerminalTheme,
  type UITheme,
} from "../types.js";
import { RouterController } from "../controllers/router-controller.js";
import "./cr-icon.js";
import "./cr-sidebar-nav.js";
import "./cr-overview-page.js";
import "./cr-provider-page.js";
import "./cr-settings-page.js";
import "./cr-toast-notification.js";
import "./cr-theme-toggle.js";

type NoticeTone = "success" | "warning" | "error";
type WorkspaceTab = "overview" | "diff" | "commits" | "comments";
type AnalysisTab = "review" | "summary" | "chat";

type SelectedInlineTarget = {
  filePath: string;
  line: number;
  positionType: "new" | "old";
  text: string;
  key: string;
  anchorTop: number;
  anchorLeft: number;
};

type ConfigDraft = {
  openaiApiUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  useCustomStreaming: boolean;
  defaultReviewAgents: string[];
  gitlabUrl: string;
  gitlabKey: string;
  githubUrl: string;
  githubToken: string;
  rbUrl: string;
  rbToken: string;
  gitlabWebhookSecret: string;
  githubWebhookSecret: string;
  rbWebhookSecret: string;
  sslCertPath: string;
  sslKeyPath: string;
  sslCaPath: string;
  webhookConcurrency: string;
  webhookQueueLimit: string;
  webhookJobTimeoutMs: string;
  terminalTheme: TerminalTheme | "";
  gitlabEnabled: boolean;
  githubEnabled: boolean;
  reviewboardEnabled: boolean;
  gitlabWebhookEnabled: boolean;
  githubWebhookEnabled: boolean;
  reviewboardWebhookEnabled: boolean;
};

function isProviderSection(value: DashboardSection): value is ProviderId {
  return providerOrder.includes(value as ProviderId);
}

function createProviderRecord<T>(createValue: () => T): Record<ProviderId, T> {
  return {
    gitlab: createValue(),
    github: createValue(),
    reviewboard: createValue(),
  };
}

function emptyConfigDraft(): ConfigDraft {
  return {
    openaiApiUrl: "",
    openaiApiKey: "",
    openaiModel: "",
    useCustomStreaming: false,
    defaultReviewAgents: ["general"],
    gitlabUrl: "",
    gitlabKey: "",
    githubUrl: "",
    githubToken: "",
    rbUrl: "",
    rbToken: "",
    gitlabWebhookSecret: "",
    githubWebhookSecret: "",
    rbWebhookSecret: "",
    sslCertPath: "",
    sslKeyPath: "",
    sslCaPath: "",
    webhookConcurrency: "3",
    webhookQueueLimit: "50",
    webhookJobTimeoutMs: "600000",
    terminalTheme: "",
    gitlabEnabled: true,
    githubEnabled: true,
    reviewboardEnabled: true,
    gitlabWebhookEnabled: true,
    githubWebhookEnabled: true,
    reviewboardWebhookEnabled: true,
  };
}

@customElement("cr-dashboard-app")
export class CrDashboardApp extends LitElement {
  override createRenderRoot() {
    return this;
  }

  private router = new RouterController(this, (section) => {
    void this.handleSectionChange(section);
  });

  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Data State ──────────────────────────────────────

  @state() dashboard: DashboardData | null = null;
  @state() agentOptions: ReviewAgentOption[] = [];
  @state() provider: ProviderId = "gitlab";
  @state() stateFilter: ReviewState = "opened";
  @state() searchTerm = "";
  @state() targets: ReviewTarget[] = [];
  @state() selectedTarget: ReviewTarget | null = null;
  @state() detailTarget: ReviewTarget | null = null;
  @state() diffFiles: ReviewDiffFile[] = [];
  @state() commits: ReviewCommit[] = [];
  @state() selectedFileId = "";
  @state() selectedFilePatch = "";
  @state() selectedLine: SelectedInlineTarget | null = null;

  // ── UI State ────────────────────────────────────────

  @state() workspaceTab: WorkspaceTab = "diff";
  @state() analysisTab: AnalysisTab = "review";
  @state() selectedAgents: string[] = [];
  @state() inlineCommentsEnabled = true;
  @state() feedbackDraft = "";
  @state() summaryDraft = "";
  @state() inlineDraft = "";
  @state() chatQuestion = "";
  @state() replyingToThreadId = "";
  @state() discussionReplyDraft = "";

  // ── AI Results ──────────────────────────────────────

  @state() reviewResult: ReviewWorkflowResult | null = null;
  @state() summaryResult: ReviewWorkflowResult | null = null;
  @state() chatContext: ReviewChatContext | null = null;
  @state() chatHistory: ReviewChatHistoryEntry[] = [];

  // ── Discussions ─────────────────────────────────────

  @state() discussions: ReviewDiscussionThread[] = [];
  @state() loadingDiscussions = false;
  @state() discussionsError = "";
  @state() editingDiscussionMessageId = "";
  @state() editingDiscussionDraft = "";
  @state() savingDiscussionMessage = false;
  @state() deletingDiscussionMessageId = "";

  // ── Config ──────────────────────────────────────────

  @state() configDraft: ConfigDraft = emptyConfigDraft();
  @state() configBaseline: ConfigDraft = emptyConfigDraft();

  // ── Notices ─────────────────────────────────────────

  @state() noticeMessage = "";
  @state() noticeTone: NoticeTone = "success";

  // ── Loading / Error ─────────────────────────────────

  @state() loadingDashboard = false;
  @state() loadingTargets = false;
  @state() loadingDetail = false;
  @state() loadingDiffPatch = false;
  @state() loadingConfig = false;
  @state() savingConfig = false;
  @state() testResults: Partial<
    Record<
      "gitlab" | "github" | "reviewboard" | "openai",
      TestConnectionResult & { testing?: boolean }
    >
  > = {};
  @state() runningReview = false;
  @state() runningSummary = false;
  @state() loadingChat = false;
  @state() postingGeneratedReview = false;
  @state() postingSummary = false;
  @state() postingInline = false;
  @state() postingDiscussionReply = false;
  @state() targetsError = "";
  @state() detailError = "";
  @state() reviewWarnings: string[] = [];

  // ── Provider Repositories ───────────────────────────

  @state() providerRepositories: Record<ProviderId, ProviderRepositoryOption[]> =
    createProviderRecord(() => []);
  @state() selectedRepositories: Record<
    ProviderId,
    ProviderRepositoryOption | null
  > = createProviderRecord(() => null);
  @state() loadingProviderRepositories: Record<ProviderId, boolean> =
    createProviderRecord(() => false);
  @state() providerRepositoriesError: Record<ProviderId, string> =
    createProviderRecord(() => "");

  // ── Theme ───────────────────────────────────────────

  @state() uiTheme: UITheme = "dark";
  @state() sidebarCollapsed = true;

  // ── Lifecycle ───────────────────────────────────────

  connectedCallback() {
    super.connectedCallback();
    this.uiTheme = this.readStoredTheme();
    this.sidebarCollapsed = this.readStoredSidebarCollapsed();
    this.syncTheme();
    void this.loadInitialData();
  }

  // ── Data Loading ────────────────────────────────────

  private async loadInitialData(options: { preserveProvider?: boolean } = {}) {
    this.loadingDashboard = true;
    this.loadingConfig = true;
    this.targetsError = "";

    try {
      const [dashboard, agentOptions, config] = await Promise.all([
        loadDashboard(),
        loadReviewAgents(),
        loadConfig(),
      ]);

      this.dashboard = dashboard;
      this.agentOptions = agentOptions;
      this.selectedAgents = agentOptions
        .filter((option) => option.selected)
        .map((option) => option.value);
      this.applyConfig(config, dashboard, agentOptions);

      if (!options.preserveProvider) {
        const section = this.router.section;
        if (isProviderSection(section)) {
          this.provider = section;
        } else {
          this.provider =
            providerOrder.find((p) => this.providerIsReady(p, dashboard)) ??
            providerOrder.find(
              (p) => dashboard.providers?.[p]?.configured
            ) ??
            this.provider;
        }
      }

      await this.ensureProviderRepositoriesLoaded(this.provider);

      if (this.canLoadProviderQueue(this.provider)) {
        await this.loadTargets();
      } else {
        this.targets = [];
        this.targetsError = "";
      }
    } catch (error) {
      this.targetsError = this.toMessage(error);
    } finally {
      this.loadingDashboard = false;
      this.loadingConfig = false;
      this.dismissBootLoader();
    }
  }

  private async ensureProviderRepositoriesLoaded(
    provider: ProviderId,
    options: { force?: boolean } = {}
  ) {
    if (!this.dashboard?.providers?.[provider]?.configured) {
      return;
    }

    if (!options.force && this.providerRepositories[provider].length > 0) {
      return;
    }

    this.loadingProviderRepositories = {
      ...this.loadingProviderRepositories,
      [provider]: true,
    };
    this.providerRepositoriesError = {
      ...this.providerRepositoriesError,
      [provider]: "",
    };

    try {
      const repositories = await loadProviderRepositories(provider);
      this.providerRepositories = {
        ...this.providerRepositories,
        [provider]: repositories,
      };

      const selected = this.selectedRepositories[provider];
      const nextSelected = selected
        ? repositories.find((r) => r.id === selected.id) ?? null
        : null;

      this.selectedRepositories = {
        ...this.selectedRepositories,
        [provider]: nextSelected,
      };
    } catch (error) {
      this.providerRepositoriesError = {
        ...this.providerRepositoriesError,
        [provider]: this.toMessage(error),
      };
    } finally {
      this.loadingProviderRepositories = {
        ...this.loadingProviderRepositories,
        [provider]: false,
      };
    }
  }

  private async loadTargets() {
    this.loadingTargets = true;
    this.targetsError = "";
    this.targets = [];
    this.selectedTarget = null;
    this.detailTarget = null;
    this.resetWorkspaceState();

    const providerError = this.providerAvailabilityError;
    if (providerError) {
      this.targetsError = this.selectedRepositories[this.provider]
        ? providerError
        : "";
      this.loadingTargets = false;
      return;
    }

    try {
      const targets = await loadReviewTargets(
        this.provider,
        this.stateFilter,
        this.activeRepositoryContext
      );
      this.targets = targets;
      const nextTarget = targets[0] ?? null;
      this.selectedTarget = nextTarget;
      if (nextTarget) {
        await this.loadTargetDetail(nextTarget);
      }
    } catch (error) {
      this.targetsError = this.toMessage(error);
    } finally {
      this.loadingTargets = false;
    }
  }

  private async loadTargetDetail(target: ReviewTarget) {
    this.loadingDetail = true;
    this.detailError = "";
    this.selectedTarget = target;
    this.detailTarget = null;
    this.diffFiles = [];
    this.commits = [];
    this.selectedFileId = "";
    this.selectedFilePatch = "";
    this.selectedLine = null;
    this.reviewResult = null;
    this.summaryResult = null;
    this.chatContext = null;
    this.chatHistory = [];
    this.reviewWarnings = [];

    try {
      const [detail, diffFiles, commits] = await Promise.all([
        loadReviewDetail(
          target.provider,
          target.id,
          this.activeRepositoryContext
        ),
        loadReviewDiffs(
          target.provider,
          target.id,
          this.activeRepositoryContext
        ),
        loadReviewCommits(
          target.provider,
          target.id,
          this.activeRepositoryContext
        ),
      ]);
      this.detailTarget = { ...target, ...detail };
      this.diffFiles = diffFiles;
      this.commits = commits;

      const firstFile = diffFiles[0];
      if (firstFile) {
        await this.selectFile(firstFile);
      }

      if (this.workspaceTab === "comments") {
        await this.loadDiscussions();
      }
    } catch (error) {
      this.detailError = this.toMessage(error);
    } finally {
      this.loadingDetail = false;
    }
  }

  private async selectFile(file: ReviewDiffFile) {
    this.selectedFileId = file.id;

    if (file.patch) {
      this.selectedFilePatch = file.patch;
      return;
    }

    if (
      this.provider === "reviewboard" &&
      this.selectedTarget &&
      file.diffSetId !== undefined &&
      file.fileDiffId !== undefined
    ) {
      this.loadingDiffPatch = true;
      try {
        const patch = await loadReviewBoardFilePatch(
          this.selectedTarget.id,
          file.diffSetId,
          file.fileDiffId
        );
        this.selectedFilePatch = patch;
        this.diffFiles = this.diffFiles.map((item) =>
          item.id === file.id ? { ...item, patch } : item
        );
      } catch (error) {
        this.selectedFilePatch = "";
        this.setNotice(this.toMessage(error), "error");
      } finally {
        this.loadingDiffPatch = false;
      }
      return;
    }

    this.selectedFilePatch = "";
  }

  private async loadDiscussions() {
    if (!this.selectedTarget) {
      this.discussions = [];
      this.discussionsError = "";
      return;
    }

    if (this.selectedTarget.provider === "reviewboard") {
      this.discussions = [];
      this.discussionsError = "";
      return;
    }

    this.loadingDiscussions = true;
    this.discussionsError = "";

    try {
      this.discussions = await loadReviewDiscussions(
        this.selectedTarget.provider,
        this.selectedTarget.id,
        this.activeRepositoryContext
      );
    } catch (error) {
      this.discussionsError = this.toMessage(error);
    } finally {
      this.loadingDiscussions = false;
    }
  }

  // ── Section Navigation ──────────────────────────────

  private async handleSectionChange(section: DashboardSection) {
    this.router.navigate(section);
    if (!isProviderSection(section) || section === this.provider) {
      return;
    }

    this.provider = section;
    await this.ensureProviderRepositoriesLoaded(section);

    if (this.canLoadProviderQueue(section)) {
      await this.loadTargets();
    } else {
      this.targets = [];
      this.targetsError = "";
      this.selectedTarget = null;
      this.detailTarget = null;
      this.resetWorkspaceState();
    }
  }

  private async handleStateChange(nextState: ReviewState) {
    if (nextState === this.stateFilter) {
      return;
    }
    this.stateFilter = nextState;
    await this.loadTargets();
  }

  private async handleWorkspaceTabChange(tab: WorkspaceTab) {
    this.workspaceTab = tab;

    if (tab !== "diff") {
      this.selectedLine = null;
    }

    if (tab === "comments") {
      await this.loadDiscussions();
    }
  }

  // ── AI Workflow Handlers ────────────────────────────

  private async handleRunReview() {
    if (!this.selectedTarget || !this.canRunRepositoryWorkflows) {
      return;
    }

    this.runningReview = true;
    this.analysisTab = "review";
    this.reviewWarnings = [];
    try {
      const response = await runReview({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        repoPath: this.activeRepositoryContext?.repoPath || undefined,
        url: this.activeRepositoryContext?.remoteUrl || undefined,
        agentNames: this.selectedAgents,
        inlineComments: this.inlineCommentsEnabled,
        userFeedback: this.feedbackDraft.trim() || undefined,
      });
      this.reviewResult = response.result;
      this.reviewWarnings = response.warnings;
      this.feedbackDraft = "";
      this.setNotice(
        "AI review is ready. Inspect it before posting anything.",
        "success"
      );
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.runningReview = false;
    }
  }

  private async handleRunSummary() {
    if (!this.selectedTarget || !this.canRunRepositoryWorkflows) {
      return;
    }

    this.runningSummary = true;
    this.analysisTab = "summary";
    try {
      const response = await runSummary({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        repoPath: this.activeRepositoryContext?.repoPath || undefined,
        url: this.activeRepositoryContext?.remoteUrl || undefined,
      });
      this.summaryResult = response.result;
      this.setNotice(
        "Summary generated for the active review target.",
        "success"
      );
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.runningSummary = false;
    }
  }

  private async ensureChatContext() {
    if (
      !this.selectedTarget ||
      this.chatContext ||
      !this.canRunRepositoryWorkflows
    ) {
      return;
    }

    this.loadingChat = true;
    try {
      this.chatContext = await loadChatContext({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        repoPath: this.activeRepositoryContext?.repoPath || undefined,
        url: this.activeRepositoryContext?.remoteUrl || undefined,
      });
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.loadingChat = false;
    }
  }

  private async handleAskQuestion() {
    if (
      !this.chatContext ||
      !this.chatQuestion.trim() ||
      !this.canRunRepositoryWorkflows
    ) {
      return;
    }

    this.loadingChat = true;
    try {
      const response = await answerChatQuestion({
        context: this.chatContext,
        question: this.chatQuestion.trim(),
        history: this.chatHistory,
      });
      this.chatHistory = response.history;
      this.chatQuestion = "";
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.loadingChat = false;
    }
  }

  // ── Post Handlers ───────────────────────────────────

  private async handlePostGeneratedReview() {
    if (!this.selectedTarget || !this.reviewResult) {
      return;
    }

    this.postingGeneratedReview = true;
    try {
      const response = await postGeneratedReview({
        provider: this.selectedTarget.provider,
        result: this.reviewResult,
      });
      this.setNotice(
        `Posted generated review${response.posted.inlineNoteIds.length > 0 ? ` with ${response.posted.inlineNoteIds.length} inline comments` : ""}.`,
        "success"
      );
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.postingGeneratedReview = false;
    }
  }

  private async handlePostSummaryComment() {
    if (!this.selectedTarget || !this.summaryDraft.trim()) {
      return;
    }

    this.postingSummary = true;
    try {
      await postSummaryComment({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        body: this.summaryDraft.trim(),
        repositoryContext: this.activeRepositoryContext,
      });
      this.summaryDraft = "";
      await this.loadDiscussions();
      this.setNotice("Summary comment posted to the provider.", "success");
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.postingSummary = false;
    }
  }

  private async handlePostInlineComment() {
    if (
      !this.selectedTarget ||
      !this.selectedLine ||
      !this.inlineDraft.trim()
    ) {
      return;
    }

    this.postingInline = true;
    try {
      await postInlineComment({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        filePath: this.selectedLine.filePath,
        line: this.selectedLine.line,
        positionType: this.selectedLine.positionType,
        body: this.inlineDraft.trim(),
        repositoryContext: this.activeRepositoryContext,
      });
      this.inlineDraft = "";
      this.selectedLine = null;
      await this.loadDiscussions();
      this.setNotice("Inline comment posted.", "success");
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.postingInline = false;
    }
  }

  private startReplyToThread(thread: ReviewDiscussionThread) {
    if (!thread.replyable) {
      return;
    }
    this.cancelEditingDiscussionMessage();
    this.replyingToThreadId = thread.id;
    this.discussionReplyDraft = "";
  }

  private cancelReplyToThread() {
    this.replyingToThreadId = "";
    this.discussionReplyDraft = "";
  }

  private startEditingDiscussionMessage(detail: {
    thread: ReviewDiscussionThread;
    message: ReviewDiscussionThread["messages"][number];
  }) {
    this.cancelReplyToThread();
    this.editingDiscussionMessageId = detail.message.id;
    this.editingDiscussionDraft = detail.message.body;
  }

  private cancelEditingDiscussionMessage() {
    this.editingDiscussionMessageId = "";
    this.editingDiscussionDraft = "";
  }

  private async handlePostDiscussionReply(detail: {
    threadId: string;
    replyTargetId?: string;
    body: string;
  }) {
    const body = detail.body.trim();
    if (!this.selectedTarget || !body) {
      return;
    }

    this.postingDiscussionReply = true;
    try {
      await replyToReviewDiscussion({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        threadId: detail.threadId,
        replyTargetId: detail.replyTargetId,
        body,
        repositoryContext: this.activeRepositoryContext,
      });
      this.cancelReplyToThread();
      await this.loadDiscussions();
      this.setNotice("Reply posted to the discussion.", "success");
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.postingDiscussionReply = false;
    }
  }

  private async handleSaveDiscussionMessageEdit(detail: {
    threadId: string;
    messageId: string;
    body: string;
  }) {
    const body = detail.body.trim();
    if (!this.selectedTarget || !body) {
      return;
    }

    this.savingDiscussionMessage = true;
    try {
      await updateReviewDiscussionMessage({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        threadId: detail.threadId,
        messageId: detail.messageId,
        body,
        repositoryContext: this.activeRepositoryContext,
      });
      this.cancelEditingDiscussionMessage();
      await this.loadDiscussions();
      this.setNotice("Comment updated.", "success");
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.savingDiscussionMessage = false;
    }
  }

  private async handleDeleteDiscussionMessage(detail: {
    threadId: string;
    messageId: string;
  }) {
    if (!this.selectedTarget) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this comment permanently? This cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    this.deletingDiscussionMessageId = detail.messageId;
    try {
      await deleteReviewDiscussionMessage({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        threadId: detail.threadId,
        messageId: detail.messageId,
        repositoryContext: this.activeRepositoryContext,
      });
      if (this.editingDiscussionMessageId === detail.messageId) {
        this.cancelEditingDiscussionMessage();
      }
      await this.loadDiscussions();
      this.setNotice("Comment deleted.", "success");
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.deletingDiscussionMessageId = "";
    }
  }

  // ── Repository Handlers ─────────────────────────────

  private async handleProviderRepositorySelected(
    event: CustomEvent<ProviderRepositoryOption>
  ) {
    const repository = event.detail;
    this.selectedRepositories = {
      ...this.selectedRepositories,
      [repository.provider]: repository,
    };
    this.searchTerm = "";
    this.setNotice(
      `${repository.label} is now active for ${providerLabels[repository.provider]}.`,
      "success"
    );
    await this.loadTargets();
  }

  private async refreshProviderRepositories(
    provider: ProviderId = this.provider
  ) {
    await this.ensureProviderRepositoriesLoaded(provider, { force: true });

    if (this.canLoadProviderQueue(provider)) {
      await this.loadTargets();
      return;
    }

    this.targets = [];
    this.selectedTarget = null;
    this.detailTarget = null;
    this.resetWorkspaceState();
    this.targetsError = "";
  }

  private clearSelectedRepository(provider: ProviderId = this.provider) {
    this.selectedRepositories = {
      ...this.selectedRepositories,
      [provider]: null,
    };
    this.searchTerm = "";
    this.targets = [];
    this.selectedTarget = null;
    this.detailTarget = null;
    this.resetWorkspaceState();
    this.targetsError = "";
  }

  // ── Config Handlers ─────────────────────────────────

  private handleConfigField<K extends keyof ConfigDraft>(
    key: K,
    value: ConfigDraft[K]
  ) {
    this.configDraft = {
      ...this.configDraft,
      [key]: value,
    };
  }

  private handleAgentDefaultToggle(value: string, checked: boolean) {
    const next = new Set(this.configDraft.defaultReviewAgents);
    if (checked) {
      next.add(value);
    } else if (next.size > 1) {
      next.delete(value);
    }
    this.handleConfigField("defaultReviewAgents", Array.from(next));
  }

  private async handleTestConnection(
    provider: "gitlab" | "github" | "reviewboard" | "openai"
  ) {
    this.testResults = {
      ...this.testResults,
      [provider]: { testing: true, ok: false, message: "Testing…" },
    };
    try {
      const overrides: { url?: string; token?: string } = {};
      if (provider === "gitlab") {
        overrides.url = this.configDraft.gitlabUrl.trim() || undefined;
        overrides.token = this.configDraft.gitlabKey.trim() || undefined;
      } else if (provider === "github") {
        overrides.url = this.configDraft.githubUrl.trim() || undefined;
        overrides.token = this.configDraft.githubToken.trim() || undefined;
      } else if (provider === "reviewboard") {
        overrides.url = this.configDraft.rbUrl.trim() || undefined;
        overrides.token = this.configDraft.rbToken.trim() || undefined;
      } else if (provider === "openai") {
        overrides.url = this.configDraft.openaiApiUrl.trim() || undefined;
        overrides.token = this.configDraft.openaiApiKey.trim() || undefined;
      }
      const result = await testConnection(provider, overrides);
      this.testResults = { ...this.testResults, [provider]: result };
    } catch (error) {
      this.testResults = {
        ...this.testResults,
        [provider]: {
          ok: false,
          message:
            error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private handleConfigReset() {
    this.configDraft = this.cloneDraft(this.configBaseline);
  }

  private async handleConfigSave() {
    this.savingConfig = true;
    try {
      const payload: CRConfigRecord = {
        openaiApiUrl: this.configDraft.openaiApiUrl.trim(),
        openaiApiKey: this.configDraft.openaiApiKey.trim(),
        openaiModel: this.configDraft.openaiModel.trim(),
        useCustomStreaming: this.configDraft.useCustomStreaming,
        defaultReviewAgents:
          this.configDraft.defaultReviewAgents.length > 0
            ? this.configDraft.defaultReviewAgents
            : ["general"],
        gitlabUrl: this.configDraft.gitlabUrl.trim(),
        gitlabKey: this.configDraft.gitlabKey.trim(),
        githubUrl: this.optionalString(this.configDraft.githubUrl),
        githubToken: this.optionalString(this.configDraft.githubToken),
        rbUrl: this.optionalString(this.configDraft.rbUrl),
        rbToken: this.optionalString(this.configDraft.rbToken),
        gitlabWebhookSecret: this.optionalString(
          this.configDraft.gitlabWebhookSecret
        ),
        githubWebhookSecret: this.optionalString(
          this.configDraft.githubWebhookSecret
        ),
        rbWebhookSecret: this.optionalString(
          this.configDraft.rbWebhookSecret
        ),
        sslCertPath: this.optionalString(this.configDraft.sslCertPath),
        sslKeyPath: this.optionalString(this.configDraft.sslKeyPath),
        sslCaPath: this.optionalString(this.configDraft.sslCaPath),
        webhookConcurrency: this.parseIntegerDraft(
          this.configDraft.webhookConcurrency,
          "Webhook concurrency"
        ),
        webhookQueueLimit: this.parseIntegerDraft(
          this.configDraft.webhookQueueLimit,
          "Webhook queue limit"
        ),
        webhookJobTimeoutMs: this.parseIntegerDraft(
          this.configDraft.webhookJobTimeoutMs,
          "Webhook job timeout"
        ),
        terminalTheme: this.configDraft.terminalTheme || undefined,
        gitlabEnabled: this.configDraft.gitlabEnabled,
        githubEnabled: this.configDraft.githubEnabled,
        reviewboardEnabled: this.configDraft.reviewboardEnabled,
        gitlabWebhookEnabled: this.configDraft.gitlabWebhookEnabled,
        githubWebhookEnabled: this.configDraft.githubWebhookEnabled,
        reviewboardWebhookEnabled: this.configDraft.reviewboardWebhookEnabled,
      };

      const saved = await saveConfig(payload);
      this.applyConfig(saved, this.dashboard, this.agentOptions);
      await this.loadInitialData({ preserveProvider: true });
      this.setNotice(
        "Configuration saved. Provider workspaces are now using the latest settings.",
        "success"
      );
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.savingConfig = false;
    }
  }

  // ── Agent Toggle ────────────────────────────────────

  private toggleAgent(value: string, checked: boolean) {
    const next = new Set(this.selectedAgents);
    if (checked) {
      next.add(value);
    } else if (next.size > 1) {
      next.delete(value);
    }
    this.selectedAgents = Array.from(next);
  }

  // ── Helpers ─────────────────────────────────────────

  private resetWorkspaceState() {
    this.detailTarget = null;
    this.diffFiles = [];
    this.commits = [];
    this.selectedFileId = "";
    this.selectedFilePatch = "";
    this.selectedLine = null;
    this.summaryDraft = "";
    this.inlineDraft = "";
    this.reviewResult = null;
    this.summaryResult = null;
    this.chatContext = null;
    this.chatHistory = [];
    this.chatQuestion = "";
    this.discussions = [];
    this.loadingDiscussions = false;
    this.discussionsError = "";
    this.replyingToThreadId = "";
    this.discussionReplyDraft = "";
    this.editingDiscussionMessageId = "";
    this.editingDiscussionDraft = "";
    this.savingDiscussionMessage = false;
    this.deletingDiscussionMessageId = "";
    this.feedbackDraft = "";
    this.reviewWarnings = [];
  }

  private setNotice(message: string, tone: NoticeTone) {
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
    this.noticeMessage = message;
    this.noticeTone = tone;
    this.noticeTimer = setTimeout(() => {
      this.noticeMessage = "";
      this.noticeTimer = null;
    }, 5000);
  }

  private clearNotice() {
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
    this.noticeMessage = "";
  }

  private toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /** Signal the inline boot loader to begin its exit animation. */
  private dismissBootLoader() {
    const dismiss = (window as unknown as Record<string, unknown>).__crBootDismiss;
    if (typeof dismiss === "function") dismiss();
  }

  private optionalString(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  private parseIntegerDraft(value: string, label: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${label} must be a positive integer.`);
    }
    return parsed;
  }

  private cloneDraft(draft: ConfigDraft): ConfigDraft {
    return {
      ...draft,
      defaultReviewAgents: [...draft.defaultReviewAgents],
    };
  }

  private applyConfig(
    config: CRConfigRecord,
    dashboard: DashboardData | null = this.dashboard,
    agentOptions: ReviewAgentOption[] = this.agentOptions
  ) {
    const normalized = this.normalizeConfigDraft(
      config,
      dashboard,
      agentOptions
    );
    this.configDraft = normalized;
    this.configBaseline = this.cloneDraft(normalized);
  }

  private normalizeConfigDraft(
    config: CRConfigRecord,
    dashboard: DashboardData | null,
    agentOptions: ReviewAgentOption[]
  ): ConfigDraft {
    const defaultAgents =
      config.defaultReviewAgents && config.defaultReviewAgents.length > 0
        ? config.defaultReviewAgents
        : dashboard?.config?.defaultReviewAgents?.length
          ? dashboard.config.defaultReviewAgents
          : agentOptions
              .filter((option) => option.selected)
              .map((option) => option.value);

    return {
      openaiApiUrl:
        config.openaiApiUrl ?? dashboard?.config?.openai?.apiUrl ?? "",
      openaiApiKey: config.openaiApiKey ?? "",
      openaiModel:
        config.openaiModel ?? dashboard?.config?.openai?.model ?? "",
      useCustomStreaming: Boolean(config.useCustomStreaming),
      defaultReviewAgents:
        defaultAgents.length > 0 ? defaultAgents : ["general"],
      gitlabUrl:
        config.gitlabUrl ?? dashboard?.config?.gitlab?.url ?? "",
      gitlabKey: config.gitlabKey ?? "",
      githubUrl:
        config.githubUrl ?? dashboard?.config?.github?.url ?? "",
      githubToken: config.githubToken ?? "",
      rbUrl: config.rbUrl ?? dashboard?.config?.reviewboard?.url ?? "",
      rbToken: config.rbToken ?? "",
      gitlabWebhookSecret: config.gitlabWebhookSecret ?? "",
      githubWebhookSecret: config.githubWebhookSecret ?? "",
      rbWebhookSecret: config.rbWebhookSecret ?? "",
      sslCertPath: config.sslCertPath ?? "",
      sslKeyPath: config.sslKeyPath ?? "",
      sslCaPath: config.sslCaPath ?? "",
      webhookConcurrency: String(
        config.webhookConcurrency ??
          dashboard?.config?.webhook?.concurrency ??
          3
      ),
      webhookQueueLimit: String(
        config.webhookQueueLimit ??
          dashboard?.config?.webhook?.queueLimit ??
          50
      ),
      webhookJobTimeoutMs: String(
        config.webhookJobTimeoutMs ??
          dashboard?.config?.webhook?.jobTimeoutMs ??
          600000
      ),
      terminalTheme: config.terminalTheme ?? "",
      gitlabEnabled: config.gitlabEnabled !== false,
      githubEnabled: config.githubEnabled !== false,
      reviewboardEnabled: config.reviewboardEnabled !== false,
      gitlabWebhookEnabled:
        config.gitlabWebhookEnabled ??
        dashboard?.config?.webhook?.providers?.gitlab?.enabled ??
        true,
      githubWebhookEnabled:
        config.githubWebhookEnabled ??
        dashboard?.config?.webhook?.providers?.github?.enabled ??
        true,
      reviewboardWebhookEnabled:
        config.reviewboardWebhookEnabled ??
        dashboard?.config?.webhook?.providers?.reviewboard?.enabled ??
        true,
    };
  }

  // ── Computed Getters ────────────────────────────────

  private get configured() {
    return (
      this.dashboard?.providers?.[this.provider]?.configured ?? false
    );
  }

  private get providerAvailabilityError() {
    return this.providerAvailabilityErrorFor(this.provider, this.dashboard);
  }

  private get activeRepositoryContext(): RepositoryContext | undefined {
    const repository = this.selectedRepository;
    if (!repository) {
      return undefined;
    }

    return {
      mode: "remote",
      remoteUrl: repository.remoteUrl,
      repositoryId: repository.repositoryId,
    };
  }

  private get canRunRepositoryWorkflows() {
    if (!this.selectedRepository) {
      return false;
    }

    if (this.provider === "reviewboard") {
      return Boolean(this.selectedRepository.repositoryId);
    }

    return Boolean(this.selectedRepository.remoteUrl);
  }

  private get selectedRepository() {
    return this.selectedRepositories[this.provider];
  }

  private get providerRepositoryOptions() {
    return this.providerRepositories[this.provider];
  }

  private get providerRepositoryLoading() {
    return this.loadingProviderRepositories[this.provider];
  }

  private get providerRepositoryError() {
    return this.providerRepositoriesError[this.provider];
  }

  private get themeName() {
    return this.uiTheme === "light" ? "cr-light" : "cr-black";
  }

  private providerAvailabilityErrorFor(
    provider: ProviderId,
    dashboard: DashboardData | null = this.dashboard
  ) {
    const providerData = dashboard?.providers?.[provider];
    if (!providerData?.configured) {
      return `${providerLabels[provider]} is not configured yet.`;
    }

    if (
      this.providerRepositoriesError[provider] &&
      this.providerRepositories[provider].length === 0
    ) {
      return this.providerRepositoriesError[provider];
    }

    if (!this.selectedRepositories[provider]) {
      return this.providerRepositorySelectionMessage(provider);
    }

    return "";
  }

  private providerIsReady(
    provider: ProviderId,
    dashboard: DashboardData | null = this.dashboard
  ) {
    return !this.providerAvailabilityErrorFor(provider, dashboard);
  }

  private canLoadProviderQueue(provider: ProviderId) {
    return Boolean(this.selectedRepositories[provider]);
  }

  private providerRepositorySelectionMessage(provider: ProviderId) {
    if (provider === "gitlab") {
      return "Choose a GitLab project to load merge requests.";
    }
    if (provider === "github") {
      return "Choose a GitHub repository to load pull requests.";
    }
    return "Choose a Review Board repository to load review requests.";
  }

  // ── Theme ───────────────────────────────────────────

  private readStoredTheme(): UITheme {
    try {
      return window.localStorage.getItem("pv:web-theme") === "light"
        ? "light"
        : "dark";
    } catch {
      return "dark";
    }
  }

  private persistTheme(theme: UITheme) {
    try {
      window.localStorage.setItem("pv:web-theme", theme);
    } catch {
      // Ignore storage errors in restricted environments.
    }
  }

  private readStoredSidebarCollapsed() {
    try {
      return window.localStorage.getItem("pv:web-sidebar-collapsed") !== "false";
    } catch {
      return true;
    }
  }

  private persistSidebarCollapsed(collapsed: boolean) {
    try {
      window.localStorage.setItem(
        "pv:web-sidebar-collapsed",
        String(collapsed)
      );
    } catch {
      // Ignore storage errors in restricted environments.
    }
  }

  private syncTheme() {
    document.documentElement.setAttribute("data-theme", this.themeName);
    const themeColor =
      this.uiTheme === "light" ? "#f3f7fc" : "#050608";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColor);
  }

  private toggleUiTheme() {
    this.uiTheme = this.uiTheme === "dark" ? "light" : "dark";
    this.persistTheme(this.uiTheme);
    this.syncTheme();
  }

  private toggleSidebarCollapsed() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.persistSidebarCollapsed(this.sidebarCollapsed);
  }

  // ── Render ──────────────────────────────────────────

  render() {
    const section = this.router.section;
    const isLoading =
      this.loadingDashboard || this.loadingTargets || this.loadingConfig;

    return html`
      <div
        class="drawer lg:drawer-open min-h-screen"
        data-theme=${this.themeName}
        @section-change=${(e: CustomEvent) =>
          void this.handleSectionChange(e.detail)}
        @theme-toggle=${() => this.toggleUiTheme()}
        @toggle-sidebar=${() => this.toggleSidebarCollapsed()}
      >
        <input id="cr-drawer" type="checkbox" class="drawer-toggle" />

        <div
          class="drawer-content flex flex-col min-h-screen"
        >
          <nav
            class="navbar sticky top-0 z-30 border-b border-base-300/75 bg-base-200/92 px-3 backdrop-blur-md lg:hidden"
          >
            <label
              for="cr-drawer"
              class="btn btn-ghost btn-sm btn-square"
            >
              <cr-icon .icon=${Menu} .size=${18}></cr-icon>
            </label>
            <span class="font-bold tracking-tight flex-1"
              >PeerView</span
            >
            <cr-theme-toggle
              .theme=${this.uiTheme}
            ></cr-theme-toggle>
            ${isLoading
              ? html`<span
                  class="loading loading-spinner loading-xs text-primary"
                ></span>`
              : ""}
          </nav>

          <main
            class="cr-main-shell flex-1 min-h-0 w-full max-w-[min(100%,140rem)] mx-auto px-4 py-5 sm:px-5 lg:px-7 xl:px-10 2xl:px-14"
          >
            ${section === "overview"
              ? this.renderOverviewPage()
              : section === "settings"
                ? this.renderSettingsPage()
                : this.renderProviderPage()}
          </main>
        </div>

        <div class="drawer-side z-40">
          <label for="cr-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
          <cr-sidebar-nav
            .activeSection=${section}
            .dashboard=${this.dashboard}
            .selectedAgentCount=${this.selectedAgents.length}
            .repositoryLabel=${this.selectedRepositories[this.provider]
              ?.label ?? ""}
            .isLoading=${isLoading}
            .uiTheme=${this.uiTheme}
            .collapsed=${this.sidebarCollapsed}
            style=${`--cr-sidebar-shell-width:${this.sidebarCollapsed ? "5.5rem" : "16rem"};`}
          ></cr-sidebar-nav>
        </div>

        <cr-toast-notification
          .message=${this.noticeMessage}
          .tone=${this.noticeTone}
          @dismiss=${() => this.clearNotice()}
        ></cr-toast-notification>
      </div>
    `;
  }

  private renderOverviewPage() {
    return html`
      <cr-overview-page
        .dashboard=${this.dashboard}
        .selectedAgentCount=${this.selectedAgents.length}
        .selectedRepositories=${this.selectedRepositories}
        .loading=${this.loadingDashboard}
        .activeProvider=${this.provider}
      ></cr-overview-page>
    `;
  }

  private renderSettingsPage() {
    return html`
      <cr-settings-page
        .configDraft=${this.configDraft}
        .configBaseline=${this.configBaseline}
        .dashboard=${this.dashboard}
        .agentOptions=${this.agentOptions}
        .testResults=${this.testResults}
        .savingConfig=${this.savingConfig}
        .loadingConfig=${this.loadingConfig}
        @config-field-change=${(e: CustomEvent) =>
          this.handleConfigField(e.detail.key, e.detail.value)}
        @config-save=${() => void this.handleConfigSave()}
        @config-reset=${() => this.handleConfigReset()}
        @test-connection=${(e: CustomEvent) =>
          void this.handleTestConnection(e.detail)}
        @agent-default-toggle=${(e: CustomEvent) =>
          this.handleAgentDefaultToggle(
            e.detail.value,
            e.detail.checked
          )}
      ></cr-settings-page>
    `;
  }

  private renderProviderPage() {
    return html`
      <cr-provider-page
        .provider=${this.provider}
        .configured=${this.configured}
        .dashboard=${this.dashboard}
        .targets=${this.targets}
        .selectedTarget=${this.selectedTarget}
        .detailTarget=${this.detailTarget}
        .diffFiles=${this.diffFiles}
        .commits=${this.commits}
        .selectedFileId=${this.selectedFileId}
        .selectedFilePatch=${this.selectedFilePatch}
        .selectedLine=${this.selectedLine}
        .stateFilter=${this.stateFilter}
        .workspaceTab=${this.workspaceTab}
        .analysisTab=${this.analysisTab}
        .summaryDraft=${this.summaryDraft}
        .inlineDraft=${this.inlineDraft}
        .chatQuestion=${this.chatQuestion}
        .feedbackDraft=${this.feedbackDraft}
        .replyingToThreadId=${this.replyingToThreadId}
        .discussionReplyDraft=${this.discussionReplyDraft}
        .agentOptions=${this.agentOptions}
        .selectedAgents=${this.selectedAgents}
        .inlineCommentsEnabled=${this.inlineCommentsEnabled}
        .reviewResult=${this.reviewResult}
        .summaryResult=${this.summaryResult}
        .chatContext=${this.chatContext}
        .chatHistory=${this.chatHistory}
        .discussions=${this.discussions}
        .loadingDiscussions=${this.loadingDiscussions}
        .discussionsError=${this.discussionsError}
        .editingDiscussionMessageId=${this.editingDiscussionMessageId}
        .editingDiscussionDraft=${this.editingDiscussionDraft}
        .savingDiscussionMessage=${this.savingDiscussionMessage}
        .deletingDiscussionMessageId=${this.deletingDiscussionMessageId}
        .loadingTargets=${this.loadingTargets}
        .loadingDetail=${this.loadingDetail}
        .loadingDiffPatch=${this.loadingDiffPatch}
        .loadingChat=${this.loadingChat}
        .runningReview=${this.runningReview}
        .runningSummary=${this.runningSummary}
        .postingGeneratedReview=${this.postingGeneratedReview}
        .postingSummary=${this.postingSummary}
        .postingInline=${this.postingInline}
        .postingDiscussionReply=${this.postingDiscussionReply}
        .targetsError=${this.targetsError}
        .detailError=${this.detailError}
        .reviewWarnings=${this.reviewWarnings}
        .providerRepositoryOptions=${this.providerRepositoryOptions}
        .selectedRepository=${this.selectedRepository}
        .providerRepositoryLoading=${this.providerRepositoryLoading}
        .providerRepositoryError=${this.providerRepositoryError}
        .canRunRepositoryWorkflows=${this.canRunRepositoryWorkflows}
        .searchTerm=${this.searchTerm}
        @target-selected=${(e: CustomEvent) =>
          void this.loadTargetDetail(e.detail)}
        @state-filter-change=${(e: CustomEvent) =>
          void this.handleStateChange(e.detail)}
        @file-selected=${(e: CustomEvent) =>
          void this.selectFile(e.detail)}
        @workspace-tab-change=${(e: CustomEvent) =>
          void this.handleWorkspaceTabChange(e.detail)}
        @line-selected=${(e: CustomEvent) => {
          this.selectedLine = e.detail;
        }}
        @close-inline=${() => {
          this.selectedLine = null;
          this.inlineDraft = "";
        }}
        @inline-draft-change=${(e: CustomEvent) => {
          this.inlineDraft = e.detail;
        }}
        @summary-draft-change=${(e: CustomEvent) => {
          this.summaryDraft = e.detail;
        }}
        @reply-draft-change=${(e: CustomEvent) => {
          this.discussionReplyDraft = e.detail;
        }}
        @start-edit-discussion-message=${(e: CustomEvent) =>
          this.startEditingDiscussionMessage(e.detail)}
        @cancel-edit-discussion-message=${() =>
          this.cancelEditingDiscussionMessage()}
        @discussion-edit-draft-change=${(e: CustomEvent) => {
          this.editingDiscussionDraft = e.detail;
        }}
        @question-change=${(e: CustomEvent) => {
          this.chatQuestion = e.detail;
        }}
        @feedback-change=${(e: CustomEvent) => {
          this.feedbackDraft = e.detail;
        }}
        @analysis-tab-change=${(e: CustomEvent) => {
          this.analysisTab = e.detail;
        }}
        @agent-toggle=${(e: CustomEvent) =>
          this.toggleAgent(e.detail.value, e.detail.checked)}
        @inline-toggle=${(e: CustomEvent) => {
          this.inlineCommentsEnabled = e.detail;
        }}
        @run-review=${() => void this.handleRunReview()}
        @run-summary=${() => void this.handleRunSummary()}
        @post-generated-review=${() => void this.handlePostGeneratedReview()}
        @load-chat-context=${() => void this.ensureChatContext()}
        @ask-question=${() => void this.handleAskQuestion()}
        @post-summary-comment=${() => void this.handlePostSummaryComment()}
        @post-inline-comment=${() => void this.handlePostInlineComment()}
        @start-reply=${(e: CustomEvent) =>
          this.startReplyToThread(e.detail)}
        @cancel-reply=${() => this.cancelReplyToThread()}
        @post-discussion-reply=${(e: CustomEvent) =>
          void this.handlePostDiscussionReply(e.detail)}
        @save-discussion-message-edit=${(e: CustomEvent) =>
          void this.handleSaveDiscussionMessageEdit(e.detail)}
        @delete-discussion-message=${(e: CustomEvent) =>
          void this.handleDeleteDiscussionMessage(e.detail)}
        @insert-review=${() => {
          this.summaryDraft =
            this.reviewResult?.overallSummary ||
            this.reviewResult?.output ||
            "";
        }}
        @insert-summary=${() => {
          this.summaryDraft = this.summaryResult?.output || "";
        }}
        @repository-selected=${(e: CustomEvent) =>
          void this.handleProviderRepositorySelected(e)}
        @repository-refresh=${() =>
          void this.refreshProviderRepositories()}
        @repository-clear=${() => this.clearSelectedRepository()}
        @search-change=${(e: CustomEvent) => {
          this.searchTerm = e.detail;
        }}
      ></cr-provider-page>
    `;
  }
}
