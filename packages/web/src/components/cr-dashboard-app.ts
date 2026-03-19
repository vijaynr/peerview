import { LitElement, html } from "lit";
import {
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  FileDiff,
  FolderSearch,
  GitBranch,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MoonStar,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  SunMedium,
  Waypoints,
  Webhook,
  Workflow,
  type IconNode,
} from "lucide";
import {
  answerChatQuestion,
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
  type TestConnectionResult,
} from "../api.js";
import {
  providerLabels,
  providerOrder,
  reviewStates,
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
  type ReviewDiscussionMessage,
  type ReviewDiscussionThread,
  type ReviewDiffFile,
  type ReviewState,
  type ReviewTarget,
  type ReviewWorkflowResult,
  type TerminalTheme,
  type UITheme,
} from "../types.js";
import "./cr-config-card.js";
import "./cr-dashboard-header.js";
import "./cr-diff-viewer.js";
import "./cr-icon.js";
import "./cr-provider-repository-picker.js";
import "./cr-review-list.js";
import "./cr-stat-card.js";
import { renderCollapsibleCard } from "./render-collapsible-card.js";
import { renderMarkdown } from "./render-markdown.js";

type NoticeTone = "success" | "warning" | "error";
type WorkspaceTab = "overview" | "diff" | "commits" | "comments";
type AnalysisTab = "review" | "summary" | "chat";

type SelectedInlineTarget = {
  filePath: string;
  line: number;
  positionType: "new" | "old";
  text: string;
  key: string;
};

const sectionEyebrowClass =
  "text-[0.72rem] font-semibold tracking-[0.08em] text-base-content/40";

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

export class CrDashboardApp extends LitElement {
  static properties = {
    dashboard: { state: true },
    agentOptions: { state: true },
    activeSection: { state: true },
    provider: { state: true },
    stateFilter: { state: true },
    searchTerm: { state: true },
    targets: { state: true },
    selectedTarget: { state: true },
    detailTarget: { state: true },
    diffFiles: { state: true },
    commits: { state: true },
    selectedFileId: { state: true },
    selectedFilePatch: { state: true },
    selectedLine: { state: true },
    workspaceTab: { state: true },
    analysisTab: { state: true },
    selectedAgents: { state: true },
    inlineCommentsEnabled: { state: true },
    feedbackDraft: { state: true },
    summaryDraft: { state: true },
    inlineDraft: { state: true },
    reviewResult: { state: true },
    summaryResult: { state: true },
    chatContext: { state: true },
    chatHistory: { state: true },
    chatQuestion: { state: true },
    discussions: { state: true },
    loadingDiscussions: { state: true },
    discussionsError: { state: true },
    replyingToThreadId: { state: true },
    discussionReplyDraft: { state: true },
    configDraft: { state: true },
    configBaseline: { state: true },
    noticeMessage: { state: true },
    noticeTone: { state: true },
    loadingDashboard: { state: true },
    loadingTargets: { state: true },
    loadingDetail: { state: true },
    loadingDiffPatch: { state: true },
    loadingConfig: { state: true },
    savingConfig: { state: true },
    testResults: { state: true },
    runningReview: { state: true },
    runningSummary: { state: true },
    loadingChat: { state: true },
    postingGeneratedReview: { state: true },
    postingSummary: { state: true },
    postingInline: { state: true },
    postingDiscussionReply: { state: true },
    targetsError: { state: true },
    detailError: { state: true },
    reviewWarnings: { state: true },
    queueRailCollapsed: { state: true },
    analysisRailCollapsed: { state: true },
    providerRepositories: { state: true },
    selectedRepositories: { state: true },
    loadingProviderRepositories: { state: true },
    providerRepositoriesError: { state: true },
    uiTheme: { state: true },
  };

  override createRenderRoot() { return this; }

  declare dashboard: DashboardData | null;
  declare agentOptions: ReviewAgentOption[];
  declare activeSection: DashboardSection;
  declare provider: ProviderId;
  declare stateFilter: ReviewState;
  declare searchTerm: string;
  declare targets: ReviewTarget[];
  declare selectedTarget: ReviewTarget | null;
  declare detailTarget: ReviewTarget | null;
  declare diffFiles: ReviewDiffFile[];
  declare commits: ReviewCommit[];
  declare selectedFileId: string;
  declare selectedFilePatch: string;
  declare selectedLine: SelectedInlineTarget | null;
  declare workspaceTab: WorkspaceTab;
  declare analysisTab: AnalysisTab;
  declare selectedAgents: string[];
  declare inlineCommentsEnabled: boolean;
  declare feedbackDraft: string;
  declare summaryDraft: string;
  declare inlineDraft: string;
  declare reviewResult: ReviewWorkflowResult | null;
  declare summaryResult: ReviewWorkflowResult | null;
  declare chatContext: ReviewChatContext | null;
  declare chatHistory: ReviewChatHistoryEntry[];
  declare chatQuestion: string;
  declare discussions: ReviewDiscussionThread[];
  declare loadingDiscussions: boolean;
  declare discussionsError: string;
  declare replyingToThreadId: string;
  declare discussionReplyDraft: string;
  declare configDraft: ConfigDraft;
  declare configBaseline: ConfigDraft;
  declare noticeMessage: string;
  declare noticeTone: NoticeTone;
  declare loadingDashboard: boolean;
  declare loadingTargets: boolean;
  declare loadingDetail: boolean;
  declare loadingDiffPatch: boolean;
  declare loadingConfig: boolean;
  declare savingConfig: boolean;
  declare testResults: Partial<Record<"gitlab" | "github" | "reviewboard" | "openai", TestConnectionResult & { testing?: boolean }>>;
  declare runningReview: boolean;
  declare runningSummary: boolean;
  declare loadingChat: boolean;
  declare postingGeneratedReview: boolean;
  declare postingSummary: boolean;
  declare postingInline: boolean;
  declare postingDiscussionReply: boolean;
  declare targetsError: string;
  declare detailError: string;
  declare reviewWarnings: string[];
  declare queueRailCollapsed: boolean;
  declare analysisRailCollapsed: boolean;
  declare providerRepositories: Record<ProviderId, ProviderRepositoryOption[]>;
  declare selectedRepositories: Record<ProviderId, ProviderRepositoryOption | null>;
  declare loadingProviderRepositories: Record<ProviderId, boolean>;
  declare providerRepositoriesError: Record<ProviderId, string>;
  declare uiTheme: UITheme;

  constructor() {
    super();
    this.dashboard = null;
    this.agentOptions = [];
    this.activeSection = "overview";
    this.provider = "gitlab";
    this.stateFilter = "opened";
    this.searchTerm = "";
    this.targets = [];
    this.selectedTarget = null;
    this.detailTarget = null;
    this.diffFiles = [];
    this.commits = [];
    this.selectedFileId = "";
    this.selectedFilePatch = "";
    this.selectedLine = null;
    this.workspaceTab = "diff";
    this.analysisTab = "review";
    this.selectedAgents = [];
    this.inlineCommentsEnabled = true;
    this.feedbackDraft = "";
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
    this.configDraft = this.emptyConfigDraft();
    this.configBaseline = this.emptyConfigDraft();
    this.noticeMessage = "";
    this.noticeTone = "success";
    this.loadingDashboard = false;
    this.loadingTargets = false;
    this.loadingDetail = false;
    this.loadingDiffPatch = false;
    this.loadingConfig = false;
    this.savingConfig = false;
    this.runningReview = false;
    this.runningSummary = false;
    this.loadingChat = false;
    this.postingGeneratedReview = false;
    this.postingSummary = false;
    this.postingInline = false;
    this.postingDiscussionReply = false;
    this.targetsError = "";
    this.detailError = "";
    this.reviewWarnings = [];
    this.queueRailCollapsed = false;
    this.analysisRailCollapsed = false;
    this.testResults = {};
    this.providerRepositories = createProviderRecord(() => []);
    this.selectedRepositories = createProviderRecord(() => null);
    this.loadingProviderRepositories = createProviderRecord(() => false);
    this.providerRepositoriesError = createProviderRecord(() => "");
    this.uiTheme = this.readStoredTheme();
  }

  connectedCallback() {
    super.connectedCallback();
    this.syncTheme();
    void this.loadInitialData();
  }

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
        this.provider =
          providerOrder.find((provider) => this.providerIsReady(provider, dashboard)) ??
          providerOrder.find((provider) => dashboard.providers?.[provider]?.configured) ??
          this.provider;
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
    }
  }

  private readStoredTheme(): UITheme {
    try {
      return window.localStorage.getItem("cr:web-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  private persistTheme(theme: UITheme) {
    try {
      window.localStorage.setItem("cr:web-theme", theme);
    } catch {
      // Ignore storage errors in restricted environments.
    }
  }

  private syncTheme() {
    const themeName = this.themeName;
    document.documentElement.setAttribute("data-theme", themeName);
    const themeColor = this.uiTheme === "light" ? "#f3f7fc" : "#050608";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColor);
  }

  private toggleUiTheme() {
    this.uiTheme = this.uiTheme === "dark" ? "light" : "dark";
    this.persistTheme(this.uiTheme);
    this.syncTheme();
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
        ? repositories.find((repository) => repository.id === selected.id) ?? null
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
      this.targetsError = this.selectedRepositories[this.provider] ? providerError : "";
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
        loadReviewDetail(target.provider, target.id, this.activeRepositoryContext),
        loadReviewDiffs(target.provider, target.id, this.activeRepositoryContext),
        loadReviewCommits(target.provider, target.id, this.activeRepositoryContext),
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

  private async handleSectionChange(section: DashboardSection) {
    this.activeSection = section;
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

  private async handleStateChange(state: ReviewState) {
    if (state === this.stateFilter) {
      return;
    }
    this.stateFilter = state;
    await this.loadTargets();
  }

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
      this.setNotice("AI review is ready. Inspect it before posting anything.", "success");
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
      this.setNotice("Summary generated for the active review target.", "success");
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.runningSummary = false;
    }
  }

  private async ensureChatContext() {
    if (!this.selectedTarget || this.chatContext || !this.canRunRepositoryWorkflows) {
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
    if (!this.chatContext || !this.chatQuestion.trim() || !this.canRunRepositoryWorkflows) {
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
    if (!this.selectedTarget || !this.selectedLine || !this.inlineDraft.trim()) {
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

  private startReplyToThread(thread: ReviewDiscussionThread) {
    if (!thread.replyable) {
      return;
    }

    this.replyingToThreadId = thread.id;
    this.discussionReplyDraft = "";
  }

  private cancelReplyToThread() {
    this.replyingToThreadId = "";
    this.discussionReplyDraft = "";
  }

  private async handlePostDiscussionReply(thread: ReviewDiscussionThread) {
    if (!this.selectedTarget || !thread.replyable || !this.discussionReplyDraft.trim()) {
      return;
    }

    this.postingDiscussionReply = true;
    try {
      await replyToReviewDiscussion({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        threadId: thread.id,
        replyTargetId: thread.replyTargetId,
        body: this.discussionReplyDraft.trim(),
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

  private handleTargetSelected(event: CustomEvent<ReviewTarget>) {
    void this.loadTargetDetail(event.detail);
  }

  private handleFileSelected(event: CustomEvent<ReviewDiffFile>) {
    void this.selectFile(event.detail);
  }

  private handleLineSelected(event: CustomEvent<SelectedInlineTarget>) {
    this.selectedLine = event.detail;
  }

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

  private async refreshProviderRepositories(provider: ProviderId = this.provider) {
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

  private handleConfigField<K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) {
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

  private async handleTestConnection(provider: "gitlab" | "github" | "reviewboard" | "openai") {
    this.testResults = { ...this.testResults, [provider]: { testing: true, ok: false, message: "Testing…" } };
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
      this.testResults = { ...this.testResults, [provider]: { ok: false, message: error instanceof Error ? error.message : String(error) } };
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
        gitlabWebhookSecret: this.optionalString(this.configDraft.gitlabWebhookSecret),
        githubWebhookSecret: this.optionalString(this.configDraft.githubWebhookSecret),
        rbWebhookSecret: this.optionalString(this.configDraft.rbWebhookSecret),
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
    this.feedbackDraft = "";
    this.reviewWarnings = [];
  }

  private setNotice(message: string, tone: NoticeTone) {
    this.noticeMessage = message;
    this.noticeTone = tone;
  }

  private toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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

  private emptyConfigDraft(): ConfigDraft {
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
    };
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
    const normalized = this.normalizeConfigDraft(config, dashboard, agentOptions);
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
          : agentOptions.filter((option) => option.selected).map((option) => option.value);

    return {
      openaiApiUrl: config.openaiApiUrl ?? dashboard?.config?.openai?.apiUrl ?? "",
      openaiApiKey: config.openaiApiKey ?? "",
      openaiModel: config.openaiModel ?? dashboard?.config?.openai?.model ?? "",
      useCustomStreaming: Boolean(config.useCustomStreaming),
      defaultReviewAgents: defaultAgents.length > 0 ? defaultAgents : ["general"],
      gitlabUrl: config.gitlabUrl ?? dashboard?.config?.gitlab?.url ?? "",
      gitlabKey: config.gitlabKey ?? "",
      githubUrl: config.githubUrl ?? dashboard?.config?.github?.url ?? "",
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
        config.webhookConcurrency ?? dashboard?.config?.webhook?.concurrency ?? 3
      ),
      webhookQueueLimit: String(
        config.webhookQueueLimit ?? dashboard?.config?.webhook?.queueLimit ?? 50
      ),
      webhookJobTimeoutMs: String(
        config.webhookJobTimeoutMs ?? dashboard?.config?.webhook?.jobTimeoutMs ?? 600000
      ),
      terminalTheme: config.terminalTheme ?? "",
      gitlabEnabled: config.gitlabEnabled !== false,
      githubEnabled: config.githubEnabled !== false,
      reviewboardEnabled: config.reviewboardEnabled !== false,
    };
  }

  private get configured() {
    return this.dashboard?.providers?.[this.provider]?.configured ?? false;
  }

  private get providerAvailabilityError() {
    return this.providerAvailabilityErrorFor(this.provider, this.dashboard);
  }

  private get filteredTargets() {
    const search = this.searchTerm.trim().toLowerCase();
    if (!search) {
      return this.targets;
    }

    return this.targets.filter((target) =>
      [
        target.title,
        target.author,
        target.sourceBranch,
        target.targetBranch,
        target.repository,
        String(target.id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  private get configDirty() {
    return JSON.stringify(this.configDraft) !== JSON.stringify(this.configBaseline);
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

  private providerRepositorySelectionMessage(provider: ProviderId) {
    if (provider === "gitlab") {
      return "Select a GitLab project to load merge requests.";
    }

    if (provider === "github") {
      return "Select a GitHub repository to load pull requests.";
    }

    return "Select a Review Board repository to load review requests.";
  }

  private providerAvailabilityErrorFor(
    provider: ProviderId,
    dashboard: DashboardData | null = this.dashboard
  ) {
    const providerData = dashboard?.providers?.[provider];
    if (!providerData?.configured) {
      return `${providerLabels[provider]} is not configured yet.`;
    }

    if (this.providerRepositoriesError[provider] && this.providerRepositories[provider].length === 0) {
      return this.providerRepositoriesError[provider];
    }

    if (!this.selectedRepositories[provider]) {
      return this.providerRepositorySelectionMessage(provider);
    }

    return "";
  }

  private providerIsReady(provider: ProviderId, dashboard: DashboardData | null = this.dashboard) {
    return !this.providerAvailabilityErrorFor(provider, dashboard);
  }

  private canLoadProviderQueue(provider: ProviderId) {
    return Boolean(this.selectedRepositories[provider]);
  }

  private formatLabel(value: string) {
    const normalized = value.replace(/[_-]+/g, " ").trim();
    if (!normalized) {
      return "";
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private workspaceTabLabel(tab: WorkspaceTab) {
    return this.formatLabel(tab);
  }

  private analysisTabLabel(tab: AnalysisTab) {
    return this.formatLabel(tab);
  }

  private reviewStateLabel(state: ReviewState) {
    return this.formatLabel(state);
  }

  private discussionLocationLabel(inline?: ReviewDiscussionMessage["inline"]) {
    if (!inline?.filePath) {
      return "";
    }

    const start = inline.line ? `:${inline.line}` : "";
    const end = inline.endLine && inline.endLine !== inline.line ? `-${inline.endLine}` : "";

    return `${inline.filePath}${start}${end}`;
  }

  private discussionThreadTimestamp(thread: ReviewDiscussionThread) {
    const latestMessage = thread.messages[thread.messages.length - 1];
    return latestMessage?.updatedAt || latestMessage?.createdAt || thread.messages[0]?.createdAt || "";
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

  private queueCountLabel(count: number) {
    if (this.provider === "gitlab") {
      return `${count} merge request${count === 1 ? "" : "s"}`;
    }

    if (this.provider === "github") {
      return `${count} pull request${count === 1 ? "" : "s"}`;
    }

    return `${count} review request${count === 1 ? "" : "s"}`;
  }

  private toggleQueueRail() {
    this.queueRailCollapsed = !this.queueRailCollapsed;
  }

  private toggleAnalysisRail() {
    this.analysisRailCollapsed = !this.analysisRailCollapsed;
  }

  render() {
    const repositoryLabel = this.selectedRepositories[this.provider]?.label ?? "";
    const configuredProviders = providerOrder.filter(
      (provider) => this.dashboard?.providers?.[provider]?.configured
    ).length;
    const isLoading = this.loadingDashboard || this.loadingTargets || this.loadingConfig;

    return html`
      <div class="drawer lg:drawer-open min-h-screen" data-theme=${this.themeName}>
        <input id="cr-drawer" type="checkbox" class="drawer-toggle" />

        <!-- Page content -->
        <div class="drawer-content flex flex-col min-h-screen bg-base-100">
          <!-- Top navbar -->
          <nav class="navbar sticky top-0 z-30 border-b border-base-300/75 bg-base-200/92 px-3 backdrop-blur-md lg:hidden">
            <label for="cr-drawer" class="btn btn-ghost btn-sm btn-square">
              <cr-icon .icon=${Menu} .size=${18}></cr-icon>
            </label>
            <span class="font-bold tracking-tight flex-1">CR Platform</span>
            ${this.renderThemeToggle(true)}
            ${isLoading ? html`<span class="loading loading-spinner loading-xs text-primary"></span>` : ""}
          </nav>

          <!-- Notice bar -->
          ${this.noticeMessage ? this.renderNoticeBar() : ""}

          <!-- Main content -->
          <main class="cr-main-shell flex-1 min-h-0 w-full max-w-[min(100%,112rem)] mx-auto px-3 py-4 sm:px-4 lg:px-6 xl:px-8">
            ${
              this.activeSection === "overview"
                ? this.renderOverviewPage()
                : this.activeSection === "settings"
                  ? this.renderSettingsPage()
                  : this.renderProviderPage()
            }
          </main>
        </div>

        <!-- Sidebar drawer -->
        <div class="drawer-side z-40">
          <label for="cr-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
          <aside class="border-r border-base-300/75 bg-base-200/96 w-72 min-h-full flex flex-col gap-4 p-4 backdrop-blur-md">
            <!-- Brand -->
            <div class="flex items-center gap-2 pt-1 pb-2 border-b border-base-300">
              <div class="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <cr-icon .icon=${Waypoints} .size=${16} class="text-primary"></cr-icon>
              </div>
              <div>
                <div class="font-bold text-sm tracking-tight">CR Platform</div>
                <div class="text-xs text-base-content/40">Review Command Center</div>
              </div>
              ${isLoading ? html`<span class="loading loading-spinner loading-xs text-primary ml-auto"></span>` : ""}
            </div>

            <!-- Navigation -->
            <ul class="menu menu-sm p-0 gap-0.5 flex-none">
              ${this.renderNavItem("overview", "Overview", LayoutDashboard)}
              ${providerOrder.map((p) => this.renderNavItem(p, providerLabels[p]))}
              ${this.renderNavItem("settings", "Settings", Settings2)}
            </ul>

            <!-- Workspace status -->
            <div class="flex flex-col gap-2 text-xs text-base-content/50">
              <div class="flex items-center gap-2">
                <cr-icon .icon=${Workflow} .size=${12}></cr-icon>
                <span>${configuredProviders}/3 providers configured</span>
              </div>
              <div class="flex items-center gap-2">
                <cr-icon .icon=${BrainCircuit} .size=${12}></cr-icon>
                <span>${this.selectedAgents.length || 1} active agents</span>
              </div>
              ${
                repositoryLabel
                  ? html`
                    <div class="flex items-center gap-2">
                      <cr-icon .icon=${GitBranch} .size=${12}></cr-icon>
                      <span class="truncate font-mono">${repositoryLabel}</span>
                    </div>
                  `
                  : ""
              }
            </div>

            <div class="mt-auto flex flex-col gap-3 border-t border-base-300 pt-4">
              <div class="flex items-center justify-between gap-2">
                ${this.renderThemeToggle(false)}
                ${this.renderInfoTooltip(
                  "Repository selection is handled inside each provider workspace so GitLab, GitHub, and Review Board can keep separate active project context.",
                  "Repository selection help"
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  private renderNoticeBar() {
    const alertClass =
      this.noticeTone === "success" ? "alert-success" :
      this.noticeTone === "error" ? "alert-error" : "alert-warning";
    return html`
      <div class="alert ${alertClass} rounded-none border-x-0 py-2 px-6 text-sm">
        <span class="flex-1">${this.noticeMessage}</span>
        <button class="btn btn-ghost btn-xs" type="button" @click=${() => { this.noticeMessage = ""; }}>✕</button>
      </div>
    `;
  }

  private renderThemeToggle(compact: boolean) {
    return html`
      <button
        type="button"
        class="btn ${compact ? "btn-ghost btn-sm btn-square" : "btn-ghost btn-sm justify-start gap-2 rounded-[0.8rem] border border-base-100/10 bg-base-100/50"}"
        @click=${() => this.toggleUiTheme()}
        aria-label=${this.uiTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        title=${this.uiTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        <cr-icon .icon=${this.uiTheme === "dark" ? SunMedium : MoonStar} .size=${compact ? 16 : 15}></cr-icon>
        ${compact ? "" : html`<span>${this.uiTheme === "dark" ? "Light theme" : "Dark theme"}</span>`}
      </button>
    `;
  }

  private renderInfoTooltip(message: string, label: string) {
    return html`
      <div class="tooltip tooltip-left" data-tip=${message}>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-square rounded-[0.8rem] border border-base-100/10 bg-base-100/50 text-base-content/60 hover:text-base-content"
          aria-label=${label}
          title=${label}
        >
          <cr-icon .icon=${CircleHelp} .size=${15}></cr-icon>
        </button>
      </div>
    `;
  }

  private renderNavItem(
    section: DashboardSection,
    label: string,
    icon: IconNode = this.iconForSection(section)
  ) {
    const isActive = this.activeSection === section;
    return html`
      <li>
        <a
          class="${isActive ? "active bg-primary/10 text-primary font-semibold" : ""} flex items-center gap-2.5 rounded-lg cursor-pointer"
          @click=${() => this.handleSectionChange(section)}
        >
          <cr-icon .icon=${icon} .size=${15}></cr-icon>
          ${label}
        </a>
      </li>
    `;
  }

  private iconForSection(section: DashboardSection): IconNode {
    switch (section) {
      case "overview":
        return LayoutDashboard;
      case "gitlab":
        return Workflow;
      case "github":
        return GitBranch;
      case "reviewboard":
        return ShieldCheck;
      case "settings":
        return Settings2;
    }
  }

  private iconForWorkspaceTab(tab: WorkspaceTab): IconNode {
    switch (tab) {
      case "overview":
        return LayoutDashboard;
      case "diff":
        return FileDiff;
      case "commits":
        return GitBranch;
      case "comments":
        return MessageSquare;
    }
  }

  private renderOverviewPage() {
    const configuredProviders = providerOrder.filter(
      (provider) => this.dashboard?.providers?.[provider]?.configured
    ).length;
    const defaultAgents =
      this.dashboard?.config?.defaultReviewAgents.length ?? this.selectedAgents.length ?? 0;

    return html`
      <div class="flex flex-col gap-6">
        <!-- Page header -->
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">Overview</h1>
            <p class="text-base-content/50 text-sm mt-1">Queue health, provider readiness, and review capacity at a glance.</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button class="btn btn-primary btn-sm gap-1.5" type="button" @click=${() => this.handleSectionChange(this.provider)}>
              <cr-icon .icon=${FolderSearch} .size=${14}></cr-icon>
              Open workspace
            </button>
            <button class="btn btn-ghost btn-sm gap-1.5" type="button" @click=${() => this.handleSectionChange("settings")}>
              <cr-icon .icon=${Settings2} .size=${14}></cr-icon>
              Settings
            </button>
          </div>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4 items-stretch">
          <cr-stat-card
            .eyebrow=${"Configured providers"}
            .value=${`${configuredProviders}/3`}
            .note=${"GitLab, GitHub, and Review Board status"}
            .tone=${configuredProviders === providerOrder.length ? "success" : "accent"}
            .icon=${ShieldCheck}
          ></cr-stat-card>
          <cr-stat-card
            .eyebrow=${"Workspace routing"}
            .value=${String(providerOrder.filter((provider) => Boolean(this.selectedRepositories[provider])).length)}
            .note=${"Providers with an active repository selection"}
            .tone=${providerOrder.some((provider) => this.selectedRepositories[provider]) ? "accent" : "default"}
            .icon=${FolderSearch}
          ></cr-stat-card>
          <cr-stat-card
            .eyebrow=${"Default agents"}
            .value=${String(defaultAgents || 1)}
            .note=${"Review profiles selected for new runs"}
            .icon=${Bot}
          ></cr-stat-card>
        </div>

        <!-- Provider summary cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          ${providerOrder.map((provider) => this.renderProviderSummaryCard(provider))}
        </div>

        <!-- Config overview -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <cr-config-card
            .label=${"AI runtime"}
            .value=${this.dashboard?.config?.openai?.model || "No model configured"}
            .note=${
              this.dashboard?.config?.openai?.configured
                ? this.dashboard?.config?.openai?.apiUrl || "OpenAI-compatible endpoint ready"
                : "Add model endpoint and key in Settings"
            }
          ></cr-config-card>
          <cr-config-card
            .label=${"Default review agents"}
            .value=${this.dashboard?.config?.defaultReviewAgents.join(", ") || "General"}
            .note=${"Review profiles enabled for new workflow runs"}
          ></cr-config-card>
          <cr-config-card
            .label=${"Webhook runtime"}
            .value=${`${this.dashboard?.config?.webhook?.concurrency ?? 3} workers / ${this.dashboard?.config?.webhook?.queueLimit ?? 50} queue`}
            .note=${`Timeout ${this.dashboard?.config?.webhook?.jobTimeoutMs ?? 600000} ms${this.dashboard?.config?.webhook?.sslEnabled ? " · SSL enabled" : ""}`}
          ></cr-config-card>
        </div>
      </div>
    `;
  }

  private renderProviderSummaryCard(provider: ProviderId) {
    const data = this.dashboard?.providers?.[provider];
    const label = providerLabels[provider];

    return html`
      <div class="h-full rounded-[0.55rem] border border-base-300 bg-base-200 shadow-sm px-4 py-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="${sectionEyebrowClass} mb-1 flex items-center gap-1.5">
              <cr-icon .icon=${this.iconForSection(provider)} .size=${12}></cr-icon>
              ${label}
            </div>
            <div class="text-3xl font-bold tracking-tight">
              ${this.selectedRepositories[provider] ? "Ready" : "Select"}
            </div>
          </div>
          <div class="badge ${data?.configured ? "badge-success" : "badge-error"} badge-sm shrink-0">
            ${data?.configured ? "Configured" : "Missing"}
          </div>
        </div>
        <p class="text-sm text-base-content/50 min-h-[2.5rem]">
          ${this.selectedRepositories[provider]?.label ||
          data?.error ||
          "Repository selection happens inside the provider workspace."}
        </p>
        <div class="flex gap-2 flex-wrap mt-auto">
          <button class="btn btn-ghost btn-xs gap-1.5" type="button" @click=${() => this.handleSectionChange(provider)}>
            <cr-icon .icon=${this.iconForSection(provider)} .size=${12}></cr-icon>
            Open ${label}
          </button>
          <button class="btn btn-ghost btn-xs gap-1.5" type="button" @click=${() => this.handleSectionChange("settings")}>
            <cr-icon .icon=${Settings2} .size=${12}></cr-icon>
            Settings
          </button>
        </div>
      </div>
    `;
  }

  private renderProviderPage() {
    const label = providerLabels[this.provider];
    const detail = this.detailTarget;

    if (!this.configured) {
      return html`
        <div class="hero min-h-[40vh] bg-base-200 rounded-xl border border-base-300">
          <div class="hero-content text-center flex-col gap-4 max-w-lg">
            <div class="badge badge-error badge-lg gap-1.5">
              <cr-icon .icon=${this.iconForSection(this.provider)} .size=${14}></cr-icon>
              ${label}
            </div>
            <h2 class="text-2xl font-bold">${label} is not configured</h2>
            <p class="text-base-content/50">Add your ${label} connection details in Settings before loading this provider's review queue.</p>
            <button class="btn btn-primary gap-1.5" type="button" @click=${() => this.handleSectionChange("settings")}>
              <cr-icon .icon=${Settings2} .size=${16}></cr-icon>
              Open Settings
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="cr-provider-page flex h-full min-h-0 flex-col gap-4">
        <div class="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4 items-stretch">
          <cr-stat-card
            .eyebrow=${`${label} repository`}
            .value=${this.selectedRepository ? "Connected" : "Not selected"}
            .note=${this.selectedRepository?.label || "Choose a repository below to load review items."}
            .tone=${this.selectedRepository ? "success" : "default"}
            .icon=${FolderSearch}
          ></cr-stat-card>
          <cr-stat-card
            .eyebrow=${`${label} queue`}
            .value=${String(this.targets.length)}
            .note=${this.selectedRepository ? `${this.reviewStateLabel(this.stateFilter)} items loaded` : "Repository selection is required before the queue can load."}
            .tone=${this.targets.length > 0 ? "accent" : "default"}
            .icon=${Workflow}
          ></cr-stat-card>
          <cr-stat-card
            .eyebrow=${"AI workspace"}
            .value=${detail ? this.workspaceTabLabel(this.workspaceTab) : "Standby"}
            .note=${detail ? detail.title : "Open a review request to unlock summary, chat, and review actions."}
            .tone=${detail ? "success" : "default"}
            .icon=${BrainCircuit}
          ></cr-stat-card>
        </div>

        ${this.renderRepositorySelectionCard(label)}

        <div
          class="cr-provider-workspace"
          style=${`--cr-left-rail:${this.queueRailCollapsed ? "4rem" : "23rem"}; --cr-right-rail:${this.analysisRailCollapsed ? "4rem" : "25rem"};`}
        >
          ${this.renderQueueRail(label)}
          ${this.renderWorkspacePanel(label, detail)}
          ${this.renderAnalysisRail(label, detail)}
        </div>
      </div>
    `;
  }

  private renderRepositorySelectionCard(label: string) {
    return html`
      <section class="rounded-[0.7rem] border border-base-300 bg-base-200 px-4 py-3 shadow-sm">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class=${sectionEyebrowClass}>${label}</div>
            <h2 class="text-sm font-semibold">Repository</h2>
          </div>

          <div class="min-w-[18rem] flex-1">
            <cr-provider-repository-picker
              .provider=${this.provider}
              .options=${this.providerRepositoryOptions}
              .selectedId=${this.selectedRepository?.id || ""}
              .loading=${this.providerRepositoryLoading}
              .error=${this.providerRepositoryError}
              @provider-repository-selected=${this.handleProviderRepositorySelected}
              @provider-repository-refresh=${() => this.refreshProviderRepositories(this.provider)}
            ></cr-provider-repository-picker>
          </div>

          ${this.selectedRepository
            ? html`
                <button
                  type="button"
                  class="btn btn-ghost btn-sm rounded-[0.7rem] border border-base-100/10 bg-base-100/38"
                  @click=${() => this.clearSelectedRepository(this.provider)}
                >
                  Clear
                </button>
              `
            : html``}
        </div>
      </section>
    `;
  }

  private renderQueueRail(label: string) {
    return html`
      <section
        class="cr-side-rail cr-side-rail--left rounded-[0.55rem] border border-base-300 bg-base-200 ${
          this.queueRailCollapsed ? "cr-side-rail--collapsed" : ""
        }"
      >
        <button
          class="cr-side-rail__toggle cr-side-rail__toggle--left btn btn-ghost btn-sm"
          type="button"
          @click=${() => this.toggleQueueRail()}
          aria-label=${this.queueRailCollapsed ? "Expand review queue" : "Collapse review queue"}
          aria-expanded=${String(!this.queueRailCollapsed)}
          title=${this.queueRailCollapsed ? "Expand review queue" : "Collapse review queue"}
        >
          <cr-icon
            .icon=${this.queueRailCollapsed ? ChevronRight : ChevronLeft}
            .size=${16}
          ></cr-icon>
        </button>

        <div class="cr-side-rail__inner flex h-full min-h-0 flex-col gap-3 p-4">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class=${sectionEyebrowClass}>${label}</div>
              <h2 class="text-base font-semibold">Review queue</h2>
            </div>
            <div class="badge badge-primary badge-sm">${this.reviewStateLabel(this.stateFilter)}</div>
          </div>

          <div class="tabs tabs-boxed cr-tab-strip cr-tab-strip--full">
            ${reviewStates.map(
              (state) => html`
                <button
                  type="button"
                  class="tab tab-sm cr-tab ${this.stateFilter === state ? "tab-active" : ""}"
                  ?disabled=${!this.selectedRepository}
                  @click=${() => this.handleStateChange(state)}
                >
                  ${this.reviewStateLabel(state)}
                </button>
              `,
            )}
          </div>

          <label class="input input-bordered input-sm flex items-center gap-2 w-full">
            <cr-icon .icon=${Search} .size=${14}></cr-icon>
            <input
              type="search"
              class="grow text-sm"
              placeholder="Search ID, title, author, or branch"
              ?disabled=${!this.selectedRepository}
              .value=${this.searchTerm}
              @input=${(e: Event) => {
                this.searchTerm = (e.target as HTMLInputElement).value;
              }}
            />
          </label>

          <div class="flex items-center justify-between gap-2 text-xs text-base-content/50">
            <span>${this.queueCountLabel(this.filteredTargets.length)}</span>
            <span>${label}</span>
          </div>

          <cr-review-list
            .provider=${this.provider}
            .targets=${this.filteredTargets}
            .selectedId=${this.selectedTarget?.id ?? 0}
            .loading=${this.loadingTargets}
            .error=${this.targetsError}
            .configured=${this.configured}
            .emptyTitle=${this.selectedRepository ? "" : `${providerLabels[this.provider]} repository required`}
            .emptyDescription=${this.selectedRepository ? "" : this.providerRepositorySelectionMessage(this.provider)}
            @review-selected=${this.handleTargetSelected}
          ></cr-review-list>
        </div>
      </section>
    `;
  }

  private renderWorkspacePanel(label: string, detail: ReviewTarget | null) {
    return html`
      <section class="cr-review-workspace-panel relative rounded-[0.55rem] border border-base-300 bg-base-200 p-4">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class=${sectionEyebrowClass}>${label}</div>
            <h2 class="text-base font-semibold">Review workspace</h2>
          </div>
          ${detail
            ? html`<div class="badge badge-success badge-sm">Active</div>`
            : html`<div class="badge badge-ghost badge-sm">Idle</div>`}
        </div>

        ${detail
          ? html`
              <div class="flex items-start justify-between gap-2 flex-wrap">
                <div class="flex min-w-0 flex-col gap-1">
                  <div class=${sectionEyebrowClass}>${label} review</div>
                  <h2 class="text-base font-semibold leading-snug">
                    <span class="font-mono text-primary text-sm">
                      ${detail.provider === "gitlab" ? `!${detail.id}` : `#${detail.id}`}
                    </span>
                    ${detail.title}
                  </h2>
                  <div class="mt-1 flex flex-wrap gap-1.5">
                    ${detail.state
                      ? html`
                          <span class="badge badge-sm badge-ghost">
                            ${this.formatLabel(detail.state)}
                          </span>
                        `
                      : ""}
                    ${detail.author
                      ? html`<span class="badge badge-sm badge-ghost">${detail.author}</span>`
                      : ""}
                    ${detail.sourceBranch
                      ? html`
                          <span class="badge badge-sm badge-ghost font-mono">
                            ${detail.sourceBranch}${detail.targetBranch
                              ? ` → ${detail.targetBranch}`
                              : ""}
                          </span>
                        `
                      : ""}
                    ${detail.updatedAt
                      ? html`<span class="badge badge-sm badge-ghost">${detail.updatedAt}</span>`
                      : ""}
                  </div>
                </div>
                ${detail.url
                  ? html`
                      <a
                        class="btn btn-ghost btn-xs shrink-0 gap-1.5"
                        href=${detail.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <cr-icon .icon=${ArrowUpRight} .size=${12}></cr-icon>
                        Open
                      </a>
                    `
                  : ""}
              </div>

              <div class="tabs tabs-boxed cr-tab-strip cr-tab-strip--inline self-start">
                ${(["overview", "diff", "commits", "comments"] as WorkspaceTab[]).map(
                  (tab) => html`
                    <button
                      type="button"
                      class="tab tab-sm cr-tab ${this.workspaceTab === tab ? "tab-active" : ""} gap-1.5"
                      @click=${async () => this.handleWorkspaceTabChange(tab)}
                    >
                      <cr-icon .icon=${this.iconForWorkspaceTab(tab)} .size=${13}></cr-icon>
                      ${this.workspaceTabLabel(tab)}
                    </button>
                  `,
                )}
              </div>

              <div class="relative flex-1 min-h-0 overflow-hidden">
                ${this.detailError
                  ? html`<div class="alert alert-error text-sm">${this.detailError}</div>`
                  : this.loadingDetail
                    ? html`
                        <div class="flex h-full items-center gap-2 p-4 text-base-content/50 text-sm">
                          <span class="loading loading-spinner loading-xs"></span>
                          Loading workspace…
                        </div>
                      `
                    : this.workspaceTab === "overview"
                      ? html`<div class="h-full overflow-auto pr-1">${this.renderOverview(detail)}</div>`
                      : this.workspaceTab === "comments"
                        ? this.renderCommentsWorkspace(detail)
                      : this.workspaceTab === "commits"
                        ? html`<div class="h-full overflow-auto pr-1">${this.renderCommits()}</div>`
                        : html`
                            <div class="relative h-full min-h-0">
                              <cr-diff-viewer
                                .files=${this.diffFiles}
                                .selectedFileId=${this.selectedFileId}
                                .selectedLineKey=${this.selectedLine?.key || ""}
                                .loading=${this.loadingDiffPatch}
                                .error=${this.detailError}
                                @file-selected=${this.handleFileSelected}
                                @line-selected=${this.handleLineSelected}
                              ></cr-diff-viewer>
                              ${this.renderInlineCommentPopover()}
                            </div>
                          `}
              </div>
            `
          : this.selectedRepository
            ? html`
              <div class="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-base-content/40">
                <cr-icon .icon=${FolderSearch} .size=${32}></cr-icon>
                <p class="max-w-xs text-center text-sm">
                  Select a review request from the queue to open this workspace.
                </p>
              </div>
            `
            : html`
              <div class="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-base-content/40">
                <cr-icon .icon=${FolderSearch} .size=${32}></cr-icon>
                <p class="max-w-sm text-center text-sm">
                  Choose a ${label} repository in the selector above to load review items and open the workspace.
                </p>
              </div>
            `}
      </section>
    `;
  }

  private renderAnalysisRail(label: string, detail: ReviewTarget | null) {
    return html`
      <section
        class="cr-side-rail cr-side-rail--right rounded-[0.55rem] border border-base-300 bg-base-200 ${
          this.analysisRailCollapsed ? "cr-side-rail--collapsed" : ""
        }"
      >
        <button
          class="cr-side-rail__toggle cr-side-rail__toggle--right btn btn-ghost btn-sm"
          type="button"
          @click=${() => this.toggleAnalysisRail()}
          aria-label=${this.analysisRailCollapsed ? "Expand AI action rail" : "Collapse AI action rail"}
          aria-expanded=${String(!this.analysisRailCollapsed)}
          title=${this.analysisRailCollapsed ? "Expand AI action rail" : "Collapse AI action rail"}
        >
          <cr-icon
            .icon=${this.analysisRailCollapsed ? ChevronLeft : ChevronRight}
            .size=${16}
          ></cr-icon>
        </button>

        <div class="cr-side-rail__inner flex h-full min-h-0 flex-col gap-3 p-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class=${sectionEyebrowClass}>AI workspace</div>
              <h2 class="text-base font-semibold">Action rail</h2>
            </div>
            ${detail
              ? html`<div class="badge badge-primary badge-sm">${label}</div>`
              : html`<div class="badge badge-ghost badge-sm">Standby</div>`}
          </div>

          <div class="tabs tabs-boxed cr-tab-strip cr-tab-strip--full">
            ${(["review", "summary", "chat"] as AnalysisTab[]).map(
              (tab) => html`
                <button
                  type="button"
                  class="tab tab-sm cr-tab ${this.analysisTab === tab ? "tab-active" : ""}"
                  @click=${async () => {
                    this.analysisTab = tab;
                    if (tab === "chat") {
                      await this.ensureChatContext();
                    }
                  }}
                >
                  ${this.analysisTabLabel(tab)}
                </button>
              `,
            )}
          </div>

          <div class="cr-side-rail__content flex-1 min-h-0 flex flex-col gap-3">
            ${!detail
              ? html`
                  <div class="alert text-sm">
                    ${this.selectedRepository
                      ? "Open a review request before running AI workflows."
                      : `Select a ${label} repository first, then choose a review request.`}
                  </div>
                `
              : this.analysisTab === "review"
                ? this.renderReviewPanel()
                : this.analysisTab === "summary"
                  ? this.renderSummaryPanel()
                  : this.renderChatPanel()}
          </div>
        </div>
      </section>
    `;
  }

  private renderCommentsWorkspace(detail: ReviewTarget) {
    if (detail.provider === "reviewboard") {
      return html`
        <div class="flex h-full items-center justify-center">
          <div class="max-w-md rounded-[0.75rem] border border-base-100/10 bg-base-300 px-5 py-5 text-center text-sm text-base-content/60">
            Review Board discussion threading is not exposed in this workspace yet. Use the provider page to open the review request and post summary feedback.
          </div>
        </div>
      `;
    }

    return html`
      <div class="cr-comments-workspace flex h-full min-h-0 flex-col gap-3">
        <section class="cr-discussion-composer">
          <div class="cr-discussion-composer__header">
            <div>
              <h3 class="text-base font-semibold text-base-content/92">Comments</h3>
            </div>
            <div class="cr-discussion-composer__assist">
              ${this.reviewResult
                ? html`
                    <button
                      class="btn btn-ghost btn-xs gap-1.5 rounded-[0.7rem]"
                      type="button"
                      @click=${() => {
                        this.summaryDraft = this.reviewResult?.overallSummary || this.reviewResult?.output || "";
                      }}
                    >
                      <cr-icon .icon=${Bot} .size=${12}></cr-icon>
                      Insert AI review
                    </button>
                  `
                : ""}
              ${this.summaryResult
                ? html`
                    <button
                      class="btn btn-ghost btn-xs gap-1.5 rounded-[0.7rem]"
                      type="button"
                      @click=${() => {
                        this.summaryDraft = this.summaryResult?.output || "";
                      }}
                    >
                      <cr-icon .icon=${ScrollText} .size=${12}></cr-icon>
                      Insert summary
                    </button>
                  `
                : ""}
            </div>
          </div>

          <form
            class="cr-discussion-composer__form"
            @submit=${async (event: Event) => {
              event.preventDefault();
              await this.handlePostSummaryComment();
            }}
          >
            <textarea
              class="textarea textarea-bordered textarea-sm min-h-28 text-sm cr-discussion-composer__textarea"
              rows="5"
              placeholder="Write a comment"
              .value=${this.summaryDraft}
              @input=${(e: Event) => {
                this.summaryDraft = (e.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
            <div class="cr-discussion-composer__footer">
              <div class="cr-discussion-composer__hint">Inline comments start in Diff.</div>
              <button
                class="btn btn-primary btn-sm gap-1.5"
                type="submit"
                ?disabled=${this.postingSummary || !this.summaryDraft.trim()}
              >
                ${this.postingSummary ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                Post comment
              </button>
            </div>
          </form>
        </section>

        <section class="cr-discussion-feed">
          <div class="cr-discussion-feed__body">
            ${this.loadingDiscussions
              ? html`
                  <div class="flex min-h-[16rem] items-center justify-center gap-2 text-sm text-base-content/55">
                    <span class="loading loading-spinner loading-sm"></span>
                    Loading discussions…
                  </div>
                `
              : this.discussionsError
                ? html`<div class="alert alert-warning text-sm">${this.discussionsError}</div>`
              : this.discussions.length === 0
                  ? html`
                      <div class="cr-discussion-feed__empty">
                        <p class="text-sm text-base-content/58">
                          No comments yet. Start the conversation here or add an inline note from Diff.
                        </p>
                      </div>
                    `
                  : html`
                      <div class="flex flex-col gap-4">
                        ${this.discussions.map((thread) => this.renderDiscussionThread(thread))}
                      </div>
                    `}
          </div>
        </section>
      </div>
    `;
  }

  private renderDiscussionThread(thread: ReviewDiscussionThread) {
    const replying = this.replyingToThreadId === thread.id;
    const starter = thread.messages[0]?.author || "Reviewer";
    const lastUpdated = this.discussionThreadTimestamp(thread);
    const location = this.discussionLocationLabel(
      thread.messages.find((message) => message.inline)?.inline,
    );

    return html`
      <section class="cr-discussion-thread">
        <div class="cr-discussion-thread__header">
          <div class="min-w-0">
            <h4 class="cr-discussion-thread__title">${thread.title}</h4>
            <div class="cr-discussion-thread__meta">
              <span>${starter}</span>
              ${lastUpdated ? html`<span>Updated ${lastUpdated}</span>` : ""}
              ${location ? html`<span class="cr-discussion-thread__location">${location}</span>` : ""}
              ${thread.resolved ? html`<span>Resolved</span>` : ""}
            </div>
          </div>
          ${thread.replyable
            ? html`
                <button
                  class="btn ${replying ? "btn-primary" : "btn-ghost"} btn-xs rounded-[0.7rem]"
                  type="button"
                  @click=${() => {
                    if (replying) {
                      this.cancelReplyToThread();
                      return;
                    }

                    this.startReplyToThread(thread);
                  }}
                >
                  ${replying ? "Close reply" : "Reply"}
                </button>
              `
            : ""}
        </div>

        <div class="cr-discussion-thread__messages">
          ${thread.messages.map((message, index) => this.renderDiscussionMessage(thread, message, index))}
        </div>

        ${replying
          ? html`
              <form
                class="cr-discussion-reply"
                @submit=${async (event: Event) => {
                  event.preventDefault();
                  await this.handlePostDiscussionReply(thread);
                }}
              >
                <textarea
                  class="textarea textarea-bordered textarea-sm min-h-24 text-sm"
                  rows="4"
                  placeholder="Write a reply"
                  .value=${this.discussionReplyDraft}
                  @input=${(e: Event) => {
                    this.discussionReplyDraft = (e.target as HTMLTextAreaElement).value;
                  }}
                ></textarea>
                <div class="cr-discussion-reply__footer">
                  <button
                    class="btn btn-ghost btn-sm"
                    type="button"
                    @click=${() => this.cancelReplyToThread()}
                  >
                    Cancel
                  </button>
                  <button
                    class="btn btn-primary btn-sm gap-1.5"
                    type="submit"
                    ?disabled=${this.postingDiscussionReply || !this.discussionReplyDraft.trim()}
                  >
                    ${this.postingDiscussionReply ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                    Post reply
                  </button>
                </div>
              </form>
            `
          : ""}
      </section>
    `;
  }

  private renderDiscussionMessage(
    thread: ReviewDiscussionThread,
    message: ReviewDiscussionMessage,
    index: number,
  ) {
    const author = message.author || "Reviewer";
    const timestamp = message.updatedAt || message.createdAt || "";
    const showInlineLocation = Boolean(message.inline) && thread.kind !== "inline";
    const inlineLocation = this.discussionLocationLabel(message.inline);

    return html`
      <article class="cr-discussion-message ${index === 0 ? "cr-discussion-message--root" : ""}">
        <div class="cr-discussion-message__meta">
          <div class="cr-discussion-message__author-line">
            <span class="cr-discussion-message__author">${author}</span>
            ${timestamp ? html`<span>${timestamp}</span>` : ""}
            ${showInlineLocation && inlineLocation
              ? html`<span class="cr-discussion-thread__location">${inlineLocation}</span>`
              : ""}
          </div>
          ${message.url
            ? html`
                <a
                  class="cr-discussion-message__link"
                  href=${message.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              `
            : ""}
        </div>
        <div class="cr-discussion-message__bubble">
          ${renderMarkdown(message.body, {
            className: "cr-discussion-message__markdown",
            compact: true,
            emptyText: "No comment body.",
          })}
        </div>
      </article>
    `;
  }

  private renderInlineCommentPopover() {
    if (!this.selectedLine || this.workspaceTab !== "diff") {
      return html``;
    }

    const reviewBoardInlineDisabled = this.selectedTarget?.provider === "reviewboard";

    return html`
      <div class="cr-inline-comment-popover rounded-[0.8rem] border border-base-100/12 bg-base-100/96 p-4 shadow-2xl backdrop-blur-md">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class=${sectionEyebrowClass}>Inline comment</div>
            <h3 class="text-sm font-semibold text-base-content/92">Comment on selected line</h3>
          </div>
          <button
            class="btn btn-ghost btn-xs"
            type="button"
            @click=${() => {
              this.selectedLine = null;
              this.inlineDraft = "";
            }}
          >
            Close
          </button>
        </div>

        <div class="mt-3 rounded-[0.7rem] border border-primary/20 bg-primary/8 px-3 py-3 text-xs">
          <div class="font-mono text-primary">
            ${this.selectedLine.filePath}:${this.selectedLine.line} (${this.selectedLine.positionType})
          </div>
          <div class="mt-1 truncate font-mono text-base-content/55">${this.selectedLine.text}</div>
        </div>

        ${reviewBoardInlineDisabled
          ? html`<div class="alert alert-warning mt-3 text-xs">Inline comments are not available for Review Board in this workspace.</div>`
          : ""}

        <div class="mt-3 flex flex-col gap-3">
          <textarea
            class="textarea textarea-bordered textarea-sm min-h-28 text-sm"
            rows="5"
            placeholder="Write a precise inline note"
            .value=${this.inlineDraft}
            @input=${(e: Event) => {
              this.inlineDraft = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs text-base-content/50">Inline feedback posts directly to the provider thread for this line.</div>
            <button
              class="btn btn-primary btn-sm gap-1.5"
              type="button"
              ?disabled=${this.postingInline || reviewBoardInlineDisabled || !this.inlineDraft.trim()}
              @click=${async () => this.handlePostInlineComment()}
            >
              ${this.postingInline ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
              Post inline
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderSettingsPage() {
    const gitlabConfigured = this.dashboard?.config?.gitlab?.configured;
    const githubConfigured = this.dashboard?.config?.github?.configured;
    const reviewBoardConfigured = this.dashboard?.config?.reviewboard?.configured;

    return html`
      <div class="flex flex-col gap-6 pb-24">
        <!-- Page header -->
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
          <p class="text-base-content/50 text-sm mt-1">Configure providers, AI runtime, webhooks, and server options.</p>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4 items-stretch">
          <cr-stat-card
            .eyebrow=${"AI runtime"}
            .value=${this.dashboard?.config?.openai?.model || "Not configured"}
            .note=${this.dashboard?.config?.openai?.configured ? "Model endpoint ready" : "Add API settings to enable AI"}
            .tone=${this.dashboard?.config?.openai?.configured ? "success" : "accent"}
            .icon=${BrainCircuit}
          ></cr-stat-card>
          <cr-stat-card
            .eyebrow=${"Webhook workers"}
            .value=${this.configDraft.webhookConcurrency}
            .note=${`Queue limit: ${this.configDraft.webhookQueueLimit}`}
            .icon=${Webhook}
          ></cr-stat-card>
          <cr-stat-card
            .eyebrow=${"Terminal theme"}
            .value=${this.formatLabel(this.configDraft.terminalTheme || "Auto")}
            .note=${"CLI and server terminal rendering"}
            .icon=${Waypoints}
          ></cr-stat-card>
        </div>

        ${renderCollapsibleCard({
          cardClass: "bg-base-200 border border-base-300",
          bodyClass: "px-4 pb-4 pt-0 flex flex-col gap-4",
          summary: html`
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <cr-icon .icon=${BrainCircuit} .size=${16}></cr-icon>
                <div>
                  <div class=${sectionEyebrowClass}>AI workspace</div>
                  <h3 class="text-base font-semibold">AI and defaults</h3>
                </div>
              </div>
              <div class="badge ${this.dashboard?.config?.openai?.configured ? "badge-success" : "badge-error"} badge-sm">
                ${this.dashboard?.config?.openai?.configured ? "Ready" : "Needs setup"}
              </div>
            </div>
          `,
          body: html`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${this.renderConfigInput({ label: "OpenAI API URL", note: "Compatible base URL for review, summarize, and chat.", value: this.configDraft.openaiApiUrl, onInput: (v) => this.handleConfigField("openaiApiUrl", v) })}
              ${this.renderConfigInput({ label: "OpenAI API key", note: "Stored in CR config for all AI workflows.", value: this.configDraft.openaiApiKey, type: "password", onInput: (v) => this.handleConfigField("openaiApiKey", v) })}
              ${this.renderConfigInput({ label: "Model", note: "Default model name for CR review workflows.", value: this.configDraft.openaiModel, onInput: (v) => this.handleConfigField("openaiModel", v) })}
              <div class="form-control gap-1">
                <label class="label py-0"><span class="label-text text-sm font-medium">Terminal theme</span></label>
                <div class="text-xs text-base-content/50 mb-1">Optional override for terminal-facing surfaces.</div>
                <select
                  class="select select-bordered select-sm"
                  .value=${this.configDraft.terminalTheme}
                  @change=${(e: Event) => this.handleConfigField("terminalTheme", (e.target as HTMLSelectElement).value as TerminalTheme | "")}
                >
                  <option value="">Auto</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 mt-1">
              <div></div>
              <button
                class="btn btn-outline btn-xs gap-1.5"
                type="button"
                ?disabled=${this.testResults.openai?.testing}
                @click=${() => this.handleTestConnection("openai")}
              >
                ${this.testResults.openai?.testing ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                Test connection
              </button>
            </div>
            ${this.testResults.openai && !this.testResults.openai.testing ? html`
              <div class="alert ${this.testResults.openai.ok ? "alert-success" : "alert-error"} py-2 text-sm">
                ${this.testResults.openai.ok ? "✓" : "✗"} ${this.testResults.openai.message}
              </div>` : ""}
            <div class="form-control gap-1">
              <label class="label py-0 cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  .checked=${this.configDraft.useCustomStreaming}
                  @change=${(e: Event) => this.handleConfigField("useCustomStreaming", (e.target as HTMLInputElement).checked)}
                />
                <div>
                  <span class="label-text font-medium">Use custom streaming</span>
                  <div class="text-xs text-base-content/50">Enable CR's custom SSE streaming instead of the default SDK.</div>
                </div>
              </label>
            </div>
            <div class="form-control gap-2">
              <label class="label py-0"><span class="label-text text-sm font-medium">Default review agents</span></label>
              <div class="flex flex-wrap gap-2">
                ${this.agentOptions.map(option => html`
                  <label class="cursor-pointer flex items-center gap-1.5 badge badge-ghost badge-lg">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs"
                      .checked=${this.configDraft.defaultReviewAgents.includes(option.value)}
                      @change=${(e: Event) => this.handleAgentDefaultToggle(option.value, (e.target as HTMLInputElement).checked)}
                    />
                    ${option.title}
                  </label>
                `)}
              </div>
            </div>
          `,
        })}

        <!-- Provider connections -->
        ${renderCollapsibleCard({
          cardClass: "bg-base-200 border border-base-300",
          bodyClass: "px-4 pb-4 pt-0 flex flex-col gap-4",
          summary: html`
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-2">
                <cr-icon .icon=${GitBranch} .size=${16}></cr-icon>
                <div>
                  <div class=${sectionEyebrowClass}>Sources</div>
                  <h3 class="text-base font-semibold">Source connections</h3>
                </div>
              </div>
              <div class="flex gap-1.5 flex-wrap">
                <span class="badge ${gitlabConfigured ? "badge-success" : "badge-error"} badge-sm">GitLab</span>
                <span class="badge ${githubConfigured ? "badge-success" : "badge-error"} badge-sm">GitHub</span>
                <span class="badge ${reviewBoardConfigured ? "badge-success" : "badge-error"} badge-sm">Review Board</span>
              </div>
            </div>
          `,
          body: html`

            <!-- GitLab -->
            <div class="divider my-0 text-xs">GitLab</div>
            <div class="flex items-center justify-between gap-2">
              <label class="label cursor-pointer gap-3 py-0">
                <input
                  type="checkbox"
                  class="toggle toggle-sm toggle-primary"
                  .checked=${this.configDraft.gitlabEnabled}
                  @change=${(e: Event) => this.handleConfigField("gitlabEnabled", (e.target as HTMLInputElement).checked)}
                />
                <span class="label-text font-medium">Enable GitLab</span>
              </label>
              <button
                class="btn btn-outline btn-xs gap-1.5"
                type="button"
                ?disabled=${this.testResults.gitlab?.testing}
                @click=${() => this.handleTestConnection("gitlab")}
              >
                ${this.testResults.gitlab?.testing ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                Test connection
              </button>
            </div>
            ${this.testResults.gitlab && !this.testResults.gitlab.testing ? html`
              <div class="alert ${this.testResults.gitlab.ok ? "alert-success" : "alert-error"} py-2 text-sm">
                ${this.testResults.gitlab.ok ? "✓" : "✗"} ${this.testResults.gitlab.message}
              </div>` : ""}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${this.renderConfigInput({ label: "GitLab URL", note: "Base URL for merge request and inline comment APIs.", value: this.configDraft.gitlabUrl, onInput: (v) => this.handleConfigField("gitlabUrl", v) })}
              ${this.renderConfigInput({ label: "GitLab token", note: "Private token for CR GitLab workflows.", value: this.configDraft.gitlabKey, type: "password", onInput: (v) => this.handleConfigField("gitlabKey", v) })}
            </div>

            <!-- GitHub -->
            <div class="divider my-0 text-xs">GitHub</div>
            <div class="flex items-center justify-between gap-2">
              <label class="label cursor-pointer gap-3 py-0">
                <input
                  type="checkbox"
                  class="toggle toggle-sm toggle-primary"
                  .checked=${this.configDraft.githubEnabled}
                  @change=${(e: Event) => this.handleConfigField("githubEnabled", (e.target as HTMLInputElement).checked)}
                />
                <span class="label-text font-medium">Enable GitHub</span>
              </label>
              <button
                class="btn btn-outline btn-xs gap-1.5"
                type="button"
                ?disabled=${this.testResults.github?.testing}
                @click=${() => this.handleTestConnection("github")}
              >
                ${this.testResults.github?.testing ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                Test connection
              </button>
            </div>
            ${this.testResults.github && !this.testResults.github.testing ? html`
              <div class="alert ${this.testResults.github.ok ? "alert-success" : "alert-error"} py-2 text-sm">
                ${this.testResults.github.ok ? "✓" : "✗"} ${this.testResults.github.message}
              </div>` : ""}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${this.renderConfigInput({ label: "GitHub URL", note: "Leave blank for github.com. Set to your GitHub Enterprise Server base URL.", value: this.configDraft.githubUrl, onInput: (v) => this.handleConfigField("githubUrl", v) })}
              ${this.renderConfigInput({ label: "GitHub token", note: "PAT to list pull requests and post review comments.", value: this.configDraft.githubToken, type: "password", onInput: (v) => this.handleConfigField("githubToken", v) })}
            </div>

            <!-- Review Board -->
            <div class="divider my-0 text-xs">Review Board</div>
            <div class="flex items-center justify-between gap-2">
              <label class="label cursor-pointer gap-3 py-0">
                <input
                  type="checkbox"
                  class="toggle toggle-sm toggle-primary"
                  .checked=${this.configDraft.reviewboardEnabled}
                  @change=${(e: Event) => this.handleConfigField("reviewboardEnabled", (e.target as HTMLInputElement).checked)}
                />
                <span class="label-text font-medium">Enable Review Board</span>
              </label>
              <button
                class="btn btn-outline btn-xs gap-1.5"
                type="button"
                ?disabled=${this.testResults.reviewboard?.testing}
                @click=${() => this.handleTestConnection("reviewboard")}
              >
                ${this.testResults.reviewboard?.testing ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                Test connection
              </button>
            </div>
            ${this.testResults.reviewboard && !this.testResults.reviewboard.testing ? html`
              <div class="alert ${this.testResults.reviewboard.ok ? "alert-success" : "alert-error"} py-2 text-sm">
                ${this.testResults.reviewboard.ok ? "✓" : "✗"} ${this.testResults.reviewboard.message}
              </div>` : ""}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${this.renderConfigInput({ label: "Review Board URL", note: "Base URL for review request and diff APIs.", value: this.configDraft.rbUrl, onInput: (v) => this.handleConfigField("rbUrl", v) })}
              ${this.renderConfigInput({ label: "Review Board token", note: "Token for review publishing and queue access.", value: this.configDraft.rbToken, type: "password", onInput: (v) => this.handleConfigField("rbToken", v) })}
            </div>
          `,
        })}

        <!-- Webhooks -->
        ${renderCollapsibleCard({
          cardClass: "bg-base-200 border border-base-300",
          bodyClass: "px-4 pb-4 pt-0 flex flex-col gap-4",
          summary: html`
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <cr-icon .icon=${Webhook} .size=${16}></cr-icon>
                <div>
                  <div class=${sectionEyebrowClass}>Automation</div>
                  <h3 class="text-base font-semibold">Webhooks &amp; queueing</h3>
                </div>
              </div>
              <div class="badge ${this.dashboard?.config?.webhook?.sslEnabled ? "badge-success" : "badge-ghost"} badge-sm">
                ${this.dashboard?.config?.webhook?.sslEnabled ? "SSL enabled" : "HTTP only"}
              </div>
            </div>
          `,
          body: html`
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              ${this.renderConfigInput({ label: "GitLab webhook secret", note: "Optional shared secret for GitLab webhooks.", value: this.configDraft.gitlabWebhookSecret, type: "password", onInput: (v) => this.handleConfigField("gitlabWebhookSecret", v) })}
              ${this.renderConfigInput({ label: "GitHub webhook secret", note: "Optional shared secret for GitHub webhooks.", value: this.configDraft.githubWebhookSecret, type: "password", onInput: (v) => this.handleConfigField("githubWebhookSecret", v) })}
              ${this.renderConfigInput({ label: "Review Board webhook secret", note: "Optional shared secret for Review Board webhooks.", value: this.configDraft.rbWebhookSecret, type: "password", onInput: (v) => this.handleConfigField("rbWebhookSecret", v) })}
              ${this.renderConfigInput({ label: "Concurrency", note: "Parallel webhook jobs.", value: this.configDraft.webhookConcurrency, inputMode: "numeric", onInput: (v) => this.handleConfigField("webhookConcurrency", v) })}
              ${this.renderConfigInput({ label: "Queue limit", note: "Max jobs before rejection.", value: this.configDraft.webhookQueueLimit, inputMode: "numeric", onInput: (v) => this.handleConfigField("webhookQueueLimit", v) })}
              ${this.renderConfigInput({ label: "Timeout (ms)", note: "Per-job timeout.", value: this.configDraft.webhookJobTimeoutMs, inputMode: "numeric", onInput: (v) => this.handleConfigField("webhookJobTimeoutMs", v) })}
              ${this.renderConfigInput({ label: "SSL cert path", note: "Certificate path for HTTPS.", value: this.configDraft.sslCertPath, onInput: (v) => this.handleConfigField("sslCertPath", v) })}
              ${this.renderConfigInput({ label: "SSL key path", note: "Private key path for HTTPS.", value: this.configDraft.sslKeyPath, onInput: (v) => this.handleConfigField("sslKeyPath", v) })}
              ${this.renderConfigInput({ label: "SSL CA path", note: "CA path for custom trust chain.", value: this.configDraft.sslCaPath, onInput: (v) => this.handleConfigField("sslCaPath", v) })}
            </div>
          `,
        })}
      </div>

      <!-- Sticky footer with Save / Reset -->
      <div class="fixed bottom-0 left-0 right-0 lg:left-72 bg-base-200/95 backdrop-blur-sm border-t border-base-300 z-20">
        <div class="max-w-screen-2xl mx-auto px-4 lg:px-6 xl:px-8 py-3 flex items-center justify-between gap-4">
          <div class="text-xs text-base-content/50">
            ${this.configDirty
              ? html`<span class="text-warning font-semibold">● Unsaved changes</span>`
              : html`<span>Configuration saved</span>`}
          </div>
          <div class="flex gap-2">
            <button
              class="btn btn-ghost btn-sm"
              type="button"
              ?disabled=${this.savingConfig || !this.configDirty}
              @click=${() => this.handleConfigReset()}
            >
              Reset
            </button>
            <button
              class="btn btn-primary btn-sm gap-1.5"
              type="button"
              ?disabled=${this.savingConfig || !this.configDirty}
              @click=${async () => this.handleConfigSave()}
            >
              ${this.savingConfig ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
              Save configuration
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderConfigInput(args: {
    label: string;
    note: string;
    value: string;
    onInput: (value: string) => void;
    type?: string;
    inputMode?: "text" | "numeric" | "decimal" | "search" | "email" | "tel" | "url" | "none";
  }) {
    return html`
      <div class="form-control gap-1">
        <label class="label py-0"><span class="label-text text-sm font-medium">${args.label}</span></label>
        <div class="text-xs text-base-content/50 mb-1">${args.note}</div>
        <input
          class="input input-bordered input-sm font-mono w-full"
          type=${args.type || "text"}
          .value=${args.value}
          inputmode=${args.inputMode || "text"}
          @input=${(e: Event) => args.onInput((e.target as HTMLInputElement).value)}
        />
      </div>
    `;
  }

  private renderOverview(detail: ReviewTarget) {
    return html`
      <div class="flex flex-col gap-4 min-h-0">
        <div class="rounded-[0.55rem] border border-base-100/10 bg-base-300 px-4 py-4 flex flex-col gap-3">
          <div class=${sectionEyebrowClass}>Request summary</div>
          ${renderMarkdown(detail.description || detail.summary, {
            className: "text-sm text-base-content/70",
            emptyText: "No rich description from the provider. Use the diff and commit tabs for full review context.",
          })}
        </div>
        <div class="rounded-[0.55rem] border border-base-100/10 bg-base-300 px-4 py-4 flex flex-col gap-3">
          <div class=${sectionEyebrowClass}>Workspace stats</div>
          <div class="flex flex-wrap gap-2">
            <span class="badge badge-ghost badge-sm">${this.diffFiles.length} changed files</span>
            <span class="badge badge-ghost badge-sm">${this.commits.length} commits</span>
            <span class="badge badge-ghost badge-sm">${this.reviewResult?.inlineComments.length ?? 0} AI inline notes</span>
          </div>
        </div>
        <div class="rounded-[0.55rem] border border-base-100/10 bg-base-300 px-4 py-4 flex flex-col gap-3">
          <div class=${sectionEyebrowClass}>Workflow availability</div>
          <div class="text-xs text-base-content/60">
            ${
              detail.provider === "reviewboard"
                ? "Review Board can receive summary review posts. Inline comments are disabled in this workspace."
                : "GitLab and GitHub support AI review posts plus manual inline comments from the diff viewer."
            }
          </div>
        </div>
      </div>
    `;
  }

  private renderCommits() {
    if (this.commits.length === 0) {
      return html`<div class="alert text-sm">No commits available for this review target.</div>`;
    }
    return html`
      <div class="flex flex-col gap-2">
        ${this.commits.map(commit => html`
          <div class="rounded-[0.55rem] border border-base-100/10 bg-base-300 px-4 py-3.5 flex flex-col gap-1">
            <div class="font-semibold text-sm">${commit.title}</div>
            <div class="font-mono text-xs text-base-content/40">${commit.id}</div>
            <div class="text-xs text-base-content/50">${commit.author || "Unknown author"}${commit.createdAt ? ` · ${commit.createdAt}` : ""}</div>
          </div>
        `)}
      </div>
    `;
  }

  private renderReviewPanel() {
    return html`
      <div class="flex min-h-0 flex-col gap-3 pb-2">
        ${!this.canRunRepositoryWorkflows ? html`
          <div class="alert alert-warning text-xs">AI review requires a connected repository source before the workflow can run.</div>
        ` : ""}

        ${renderCollapsibleCard({
          cardClass: "bg-base-300 border border-base-100/10",
          summaryClass: "px-4 py-3.5",
          bodyClass: "cr-review-control-card__body",
          summary: html`
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class=${sectionEyebrowClass}>Review control</div>
                <h3 class="text-sm font-semibold">Run AI review</h3>
              </div>
              <label class="cursor-pointer flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  class="checkbox checkbox-xs"
                  .checked=${this.inlineCommentsEnabled}
                  @change=${(e: Event) => { this.inlineCommentsEnabled = (e.target as HTMLInputElement).checked; }}
                />
                Inline candidates
              </label>
            </div>
          `,
          body: html`
            <div class="cr-review-control-card__content">
              <div class="grid gap-2">
                ${this.agentOptions.map(option => html`
                  <label class="cursor-pointer flex items-start gap-2.5 rounded-[0.7rem] border px-3 py-3 transition-colors
                    ${this.selectedAgents.includes(option.value) ? "border-primary/40 bg-primary/10" : "border-base-100/10 bg-base-100/38 hover:border-base-content/20"}">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm mt-0.5"
                      .checked=${this.selectedAgents.includes(option.value)}
                      @change=${(e: Event) => this.toggleAgent(option.value, (e.target as HTMLInputElement).checked)}
                    />
                    <div class="flex flex-col gap-0.5">
                      <span class="text-sm font-medium">${option.title}</span>
                      ${option.description ? html`<span class="text-xs text-base-content/50">${option.description}</span>` : ""}
                    </div>
                  </label>
                `)}
              </div>

              <div class="form-control gap-1">
                <label class="label py-0"><span class="label-text text-xs">Focus the next run</span></label>
                <textarea
                  class="textarea textarea-bordered textarea-sm text-sm"
                  rows="4"
                  placeholder="Focus on performance, security, test coverage, or a specific subsystem"
                  .value=${this.feedbackDraft}
                  @input=${(e: Event) => { this.feedbackDraft = (e.target as HTMLTextAreaElement).value; }}
                ></textarea>
              </div>
            </div>

            <div class="cr-review-control-card__footer">
              <div class="cr-review-control-card__footer-text">
                Choose the agents above, then run the review when you are ready.
              </div>
              <div class="cr-review-control-card__footer-actions">
                <button
                  class="btn btn-primary btn-sm flex-1 gap-1.5"
                  type="button"
                  ?disabled=${!this.canRunRepositoryWorkflows || this.runningReview || this.selectedAgents.length === 0}
                  @click=${async () => this.handleRunReview()}
                >
                  ${this.runningReview ? html`<span class="loading loading-spinner loading-xs"></span>` : html`<cr-icon .icon=${Bot} .size=${14}></cr-icon>`}
                  ${this.runningReview ? "Running review…" : "Run review"}
                </button>
                <button
                  class="btn btn-ghost btn-sm gap-1.5"
                  type="button"
                  ?disabled=${!this.reviewResult || this.postingGeneratedReview}
                  @click=${() => this.handlePostGeneratedReview()}
                >
                  ${this.postingGeneratedReview ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                  Post review
                </button>
              </div>
            </div>
          `,
        })}

        ${this.reviewWarnings.map(w => html`<div class="alert alert-warning text-xs">${w}</div>`)}

        ${this.reviewResult ? html`
          <section class="rounded-[0.75rem] border border-base-100/10 bg-base-300 px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class=${sectionEyebrowClass}>Review digest</div>
                <h3 class="text-base font-semibold">Aggregated review</h3>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span class="badge badge-ghost badge-sm">${this.reviewResult.selectedAgents.length} agents</span>
                <span class="badge badge-ghost badge-sm">${this.reviewResult.inlineComments.length} inline notes</span>
                <span class="badge ${this.reviewResult.aggregated ? "badge-primary" : "badge-ghost"} badge-sm">
                  ${this.reviewResult.aggregated ? "Aggregated" : "Single agent"}
                </span>
              </div>
            </div>
            <div class="mt-3 text-sm text-base-content/80">
              ${renderMarkdown(this.reviewResult.overallSummary || this.reviewResult.output, {
                className: "text-sm text-base-content/80",
                emptyText: "No aggregate review output was generated.",
              })}
            </div>
          </section>

          ${this.reviewResult.inlineComments.length > 0 ? html`
            <section class="rounded-[0.75rem] border border-base-100/10 bg-base-300 px-4 py-4 shadow-sm">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <div class=${sectionEyebrowClass}>Inline candidates</div>
                  <h3 class="text-sm font-semibold">Suggested file comments</h3>
                </div>
                <span class="badge badge-ghost badge-sm">${this.reviewResult.inlineComments.length}</span>
              </div>
              <div class="mt-3 flex flex-col gap-2.5">
                ${this.reviewResult.inlineComments.map(c => html`
                  <div class="rounded-[0.7rem] border border-base-100/10 bg-base-100/42 px-3 py-3">
                    <div class="font-mono text-xs text-primary">${c.filePath}:${c.line}</div>
                    <div class="mt-2 text-xs text-base-content/70">
                      ${renderMarkdown(c.comment, {
                        className: "text-xs text-base-content/70",
                        compact: true,
                        emptyText: "No inline note content.",
                      })}
                    </div>
                  </div>
                `)}
              </div>
            </section>
          ` : ""}

          ${this.reviewResult.agentResults?.length ? html`
            ${renderCollapsibleCard({
              cardClass: "bg-base-300 border border-base-100/10",
              summaryClass: "px-4 py-3.5",
              bodyClass: "flex flex-col gap-3",
              summary: html`
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <div class=${sectionEyebrowClass}>Agent perspectives</div>
                    <h3 class="text-sm font-semibold">Per-agent output</h3>
                  </div>
                  <span class="badge badge-ghost badge-sm">${this.reviewResult.agentResults.length}</span>
                </div>
              `,
              body: html`
                ${this.reviewResult.agentResults.map(a => html`
                  <article class="rounded-[0.7rem] border border-base-100/10 bg-base-100/42 px-3 py-3">
                    <div class="flex items-center justify-between gap-2">
                      <div class="font-semibold text-sm">${a.name}</div>
                      ${a.failed
                        ? html`<span class="badge badge-error badge-xs">Failed</span>`
                        : html`<span class="badge badge-ghost badge-xs">Ready</span>`}
                    </div>
                    <div class="mt-2 text-xs text-base-content/70">
                      ${renderMarkdown(a.failed ? a.error || "Agent failed." : a.output, {
                        className: "text-xs text-base-content/70",
                        compact: true,
                        emptyText: "No agent output.",
                      })}
                    </div>
                  </article>
                `)}
              `,
            })}
          ` : ""}
        ` : html`
          <div class="rounded-[0.75rem] border border-dashed border-base-100/10 bg-base-300/55 px-5 py-6 text-sm text-base-content/55">
            Run review to generate an aggregated summary, inline candidates, and per-agent detail in this rail.
          </div>
        `}
      </div>
    `;
  }

  private renderSummaryPanel() {
    return html`
      <div class="flex min-h-0 flex-col gap-3 pb-2">
        ${!this.canRunRepositoryWorkflows ? html`
          <div class="alert alert-warning text-xs">Summary generation needs a connected repository source.</div>
        ` : ""}

        <section class="rounded-[0.75rem] border border-base-100/10 bg-base-300 px-4 py-4 shadow-sm">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div class=${sectionEyebrowClass}>Summary workflow</div>
              <h3 class="text-sm font-semibold">Generate summary</h3>
            </div>
            <button
              class="btn btn-primary btn-sm gap-1.5"
              type="button"
              ?disabled=${!this.canRunRepositoryWorkflows || this.runningSummary}
              @click=${async () => this.handleRunSummary()}
            >
              ${this.runningSummary ? html`<span class="loading loading-spinner loading-xs"></span>` : html`<cr-icon .icon=${ScrollText} .size=${14}></cr-icon>`}
              ${this.runningSummary ? "Generating…" : "Generate summary"}
            </button>
          </div>
          <div class="mt-2 text-xs text-base-content/55">
            Use summary generation when you want a quick narrative overview before a deeper review or discussion post.
          </div>
        </section>

        ${this.summaryResult
          ? html`
              <section class="rounded-[0.75rem] border border-base-100/10 bg-base-300 px-4 py-4 shadow-sm">
                <div class=${sectionEyebrowClass}>Summary output</div>
                <div class="mt-3 text-sm text-base-content/80">
                  ${renderMarkdown(this.summaryResult.output, {
                    className: "text-sm text-base-content/80",
                    emptyText: "No summary output was generated.",
                  })}
                </div>
              </section>
            `
          : html`
              <div class="rounded-[0.75rem] border border-dashed border-base-100/10 bg-base-300/55 px-5 py-6 text-sm text-base-content/55">
                No summary has been generated for this review target yet.
              </div>
            `}
      </div>
    `;
  }

  private renderChatPanel() {
    return html`
      <div class="flex h-full min-h-0 flex-col gap-3 pb-2">
        ${!this.canRunRepositoryWorkflows ? html`
          <div class="alert alert-warning text-xs">Review chat is available after you connect a repository source.</div>
        ` : ""}

        <section class="rounded-[0.75rem] border border-base-100/10 bg-base-300 px-4 py-4 shadow-sm">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div class=${sectionEyebrowClass}>Conversation setup</div>
              <h3 class="text-sm font-semibold">Review chat</h3>
            </div>
            <button
              class="btn btn-primary btn-sm gap-1.5"
              type="button"
              ?disabled=${!this.canRunRepositoryWorkflows || this.loadingChat}
              @click=${async () => this.ensureChatContext()}
            >
              ${this.loadingChat ? html`<span class="loading loading-spinner loading-xs"></span>` : html`<cr-icon .icon=${MessageSquare} .size=${14}></cr-icon>`}
              ${this.chatContext ? "Refresh context" : "Load chat context"}
            </button>
          </div>
          <div class="mt-2 text-xs text-base-content/55">
            Ask about risks, missing tests, intent, suspicious changes, or specific files after the context is prepared.
          </div>
          ${this.chatContext
            ? html`
                <div class="mt-3 rounded-[0.7rem] border border-base-100/10 bg-base-100/42 px-3 py-3 text-xs text-base-content/65">
                  ${renderMarkdown(this.chatContext.summary, {
                    className: "text-xs text-base-content/65",
                    compact: true,
                    emptyText: "Chat context summary is empty.",
                  })}
                </div>
              `
            : ""}
        </section>

        <section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.75rem] border border-base-100/10 bg-base-300 shadow-sm">
          <div class="border-b border-base-100/10 px-4 py-3">
            <div class=${sectionEyebrowClass}>Transcript</div>
            <h3 class="text-sm font-semibold">Conversation</h3>
          </div>

          <div class="flex-1 overflow-y-auto px-4 py-4">
            ${this.chatHistory.length > 0
              ? html`
                  <div class="flex flex-col gap-3">
                    ${this.chatHistory.flatMap(entry => [
                      html`
                        <div class="flex justify-end">
                          <div class="max-w-[92%] rounded-[0.75rem] bg-primary px-3 py-3 text-sm text-primary-content shadow-sm">
                            ${entry.question}
                          </div>
                        </div>
                      `,
                      html`
                        <div class="flex justify-start">
                          <div class="max-w-[96%] rounded-[0.75rem] border border-base-100/10 bg-base-100/48 px-3 py-3 text-sm text-base-content/82 shadow-sm">
                            ${renderMarkdown(entry.answer, {
                              className: "text-sm text-base-content/82",
                              compact: true,
                              emptyText: "No response returned.",
                            })}
                          </div>
                        </div>
                      `,
                    ])}
                  </div>
                `
              : html`
                  <div class="flex h-full min-h-[14rem] items-center justify-center text-center text-sm text-base-content/50">
                    ${this.chatContext
                      ? "Your next question will start the conversation here."
                      : "Load chat context to start asking questions about this review target."}
                  </div>
                `}
          </div>

          <div class="border-t border-base-100/10 px-4 py-4">
            <textarea
              class="textarea textarea-bordered textarea-sm min-h-24 text-sm"
              rows="4"
              placeholder="Ask about risk, intent, test gaps, branches, or a suspicious diff chunk"
              .value=${this.chatQuestion}
              @input=${(e: Event) => { this.chatQuestion = (e.target as HTMLTextAreaElement).value; }}
              @keydown=${async (e: KeyboardEvent) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) await this.handleAskQuestion(); }}
            ></textarea>
            <div class="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <div class="text-xs text-base-content/50">Press Ctrl/Cmd+Enter to send faster.</div>
              <button
                class="btn btn-primary btn-sm gap-1.5"
                type="button"
                ?disabled=${!this.canRunRepositoryWorkflows || this.loadingChat || !this.chatContext || !this.chatQuestion.trim()}
                @click=${async () => this.handleAskQuestion()}
              >
                ${this.loadingChat ? html`<span class="loading loading-spinner loading-xs"></span>` : html`<cr-icon .icon=${MessageSquare} .size=${14}></cr-icon>`}
                ${this.loadingChat ? "Thinking…" : "Ask"}
              </button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private toggleAgent(value: string, checked: boolean) {
    const next = new Set(this.selectedAgents);
    if (checked) {
      next.add(value);
    } else if (next.size > 1) {
      next.delete(value);
    }
    this.selectedAgents = Array.from(next);
  }
}

customElements.define("cr-dashboard-app", CrDashboardApp);
