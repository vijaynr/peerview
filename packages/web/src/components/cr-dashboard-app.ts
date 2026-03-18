import { LitElement, html } from "lit";
import {
  Bot,
  BrainCircuit,
  FileDiff,
  FolderSearch,
  GitBranch,
  LayoutDashboard,
  Menu,
  MessageSquare,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
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
  loadLocalRepositories,
  loadReviewAgents,
  loadReviewBoardFilePatch,
  loadReviewCommits,
  loadReviewDetail,
  loadReviewDiffs,
  loadReviewTargets,
  postGeneratedReview,
  postInlineComment,
  postSummaryComment,
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
  type RepositoryContext,
  type ReviewAgentOption,
  type ReviewChatContext,
  type ReviewChatHistoryEntry,
  type ReviewCommit,
  type ReviewDiffFile,
  type ReviewState,
  type ReviewTarget,
  type ReviewWorkflowResult,
  type TerminalTheme,
} from "../types.js";
import "./cr-config-card.js";
import "./cr-dashboard-header.js";
import "./cr-diff-viewer.js";
import "./cr-icon.js";
import "./cr-review-list.js";
import "./cr-stat-card.js";

type NoticeTone = "success" | "warning" | "error";
type WorkspaceTab = "overview" | "diff" | "commits";
type AnalysisTab = "review" | "summary" | "chat" | "comment";

type SelectedInlineTarget = {
  filePath: string;
  line: number;
  positionType: "new" | "old";
  text: string;
  key: string;
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
};

function isProviderSection(value: DashboardSection): value is ProviderId {
  return providerOrder.includes(value as ProviderId);
}

export class CrDashboardApp extends LitElement {
  static properties = {
    dashboard: { state: true },
    agentOptions: { state: true },
    activeSection: { state: true },
    provider: { state: true },
    stateFilter: { state: true },
    searchTerm: { state: true },
    repositoryUrlInput: { state: true },
    repositoryFormExpanded: { state: true },
    activeRepositoryPath: { state: true },
    activeRepositoryUrl: { state: true },
    localRepositories: { state: true },
    loadingLocalRepositories: { state: true },
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
    targetsError: { state: true },
    detailError: { state: true },
    reviewWarnings: { state: true },
  };

  override createRenderRoot() { return this; }

  declare dashboard: DashboardData | null;
  declare agentOptions: ReviewAgentOption[];
  declare activeSection: DashboardSection;
  declare provider: ProviderId;
  declare stateFilter: ReviewState;
  declare searchTerm: string;
  declare repositoryUrlInput: string;
  declare repositoryFormExpanded: boolean;
  declare activeRepositoryPath: string;
  declare activeRepositoryUrl: string;
  declare localRepositories: string[];
  declare loadingLocalRepositories: boolean;
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
  declare targetsError: string;
  declare detailError: string;
  declare reviewWarnings: string[];

  constructor() {
    super();
    this.dashboard = null;
    this.agentOptions = [];
    this.activeSection = "overview";
    this.provider = "gitlab";
    this.stateFilter = "opened";
    this.searchTerm = "";
    this.repositoryUrlInput = "";
    this.repositoryFormExpanded = false;
    this.activeRepositoryPath = "";
    this.activeRepositoryUrl = "";
    this.localRepositories = [];
    this.loadingLocalRepositories = false;
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
    this.targetsError = "";
    this.detailError = "";
    this.reviewWarnings = [];
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadLocalRepositoryOptions();
    void this.loadInitialData();
  }

  private async loadLocalRepositoryOptions() {
    this.loadingLocalRepositories = true;
    try {
      this.localRepositories = await loadLocalRepositories();
    } catch {
      this.localRepositories = [];
    } finally {
      this.loadingLocalRepositories = false;
    }
  }

  private async loadInitialData(options: { preserveProvider?: boolean } = {}) {
    this.loadingDashboard = true;
    this.loadingConfig = true;
    this.targetsError = "";

    try {
      const [dashboard, agentOptions, config] = await Promise.all([
        loadDashboard(this.activeRepositoryContext),
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

      if (this.canLoadProviderQueue(this.provider)) {
        await this.loadTargets();
      } else {
        this.targets = [];
        this.targetsError = this.repositorySelectionMessage;
      }
    } catch (error) {
      this.targetsError = this.toMessage(error);
    } finally {
      this.loadingDashboard = false;
      this.loadingConfig = false;
    }
  }

  private async refreshAll() {
    await this.loadInitialData({ preserveProvider: true });
    this.setNotice("Workspace refreshed from the latest provider state.", "success");
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
      this.targetsError = providerError;
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
    } catch (error) {
      this.detailError = this.toMessage(error);
    } finally {
      this.loadingDetail = false;
    }
  }

  private async selectFile(file: ReviewDiffFile) {
    this.selectedFileId = file.id;
    this.selectedLine = null;

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
    await this.loadTargets();
  }

  private async handleStateChange(state: ReviewState) {
    if (state === this.stateFilter) {
      return;
    }
    this.stateFilter = state;
    await this.loadTargets();
  }

  private async handleRunReview() {
    if (!this.selectedTarget) {
      return;
    }

    this.runningReview = true;
    this.analysisTab = "review";
    this.reviewWarnings = [];
    try {
      const response = await runReview({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        repoPath: this.activeRepositoryPath || undefined,
        url: this.activeRepositoryUrl || undefined,
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
    if (!this.selectedTarget) {
      return;
    }

    this.runningSummary = true;
    this.analysisTab = "summary";
    try {
      const response = await runSummary({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        repoPath: this.activeRepositoryPath || undefined,
        url: this.activeRepositoryUrl || undefined,
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
    if (!this.selectedTarget || this.chatContext) {
      return;
    }

    this.loadingChat = true;
    try {
      this.chatContext = await loadChatContext({
        provider: this.selectedTarget.provider,
        targetId: this.selectedTarget.id,
        repoPath: this.activeRepositoryPath || undefined,
        url: this.activeRepositoryUrl || undefined,
      });
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.loadingChat = false;
    }
  }

  private async handleAskQuestion() {
    if (!this.chatContext || !this.chatQuestion.trim()) {
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
      this.setNotice("Inline comment posted.", "success");
    } catch (error) {
      this.setNotice(this.toMessage(error), "error");
    } finally {
      this.postingInline = false;
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
    this.analysisTab = "comment";
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
        : dashboard?.config.defaultReviewAgents?.length
          ? dashboard.config.defaultReviewAgents
          : agentOptions.filter((option) => option.selected).map((option) => option.value);

    return {
      openaiApiUrl: config.openaiApiUrl ?? dashboard?.config.openai.apiUrl ?? "",
      openaiApiKey: config.openaiApiKey ?? "",
      openaiModel: config.openaiModel ?? dashboard?.config.openai.model ?? "",
      useCustomStreaming: Boolean(config.useCustomStreaming),
      defaultReviewAgents: defaultAgents.length > 0 ? defaultAgents : ["general"],
      gitlabUrl: config.gitlabUrl ?? dashboard?.config.gitlab?.url ?? "",
      gitlabKey: config.gitlabKey ?? "",
      githubUrl: config.githubUrl ?? dashboard?.config.github?.url ?? "",
      githubToken: config.githubToken ?? "",
      rbUrl: config.rbUrl ?? dashboard?.config.reviewboard?.url ?? "",
      rbToken: config.rbToken ?? "",
      gitlabWebhookSecret: config.gitlabWebhookSecret ?? "",
      githubWebhookSecret: config.githubWebhookSecret ?? "",
      rbWebhookSecret: config.rbWebhookSecret ?? "",
      sslCertPath: config.sslCertPath ?? "",
      sslKeyPath: config.sslKeyPath ?? "",
      sslCaPath: config.sslCaPath ?? "",
      webhookConcurrency: String(
        config.webhookConcurrency ?? dashboard?.config.webhook.concurrency ?? 3
      ),
      webhookQueueLimit: String(
        config.webhookQueueLimit ?? dashboard?.config.webhook.queueLimit ?? 50
      ),
      webhookJobTimeoutMs: String(
        config.webhookJobTimeoutMs ?? dashboard?.config.webhook.jobTimeoutMs ?? 600000
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
    if (this.activeRepositoryPath) {
      return {
        mode: "local",
        repoPath: this.activeRepositoryPath,
      };
    }

    if (this.activeRepositoryUrl) {
      return {
        mode: "remote",
        remoteUrl: this.activeRepositoryUrl,
      };
    }

    return undefined;
  }

  private get hasRepositorySelection() {
    return Boolean(this.activeRepositoryPath || this.activeRepositoryUrl);
  }

  private get canRunLocalWorkflows() {
    return Boolean(this.activeRepositoryPath || this.activeRepositoryUrl);
  }

  private get repositorySelectionMessage() {
    return "Choose a local checkout or paste a repository URL to load GitLab or GitHub review queues.";
  }

  private providerAvailabilityErrorFor(
    provider: ProviderId,
    dashboard: DashboardData | null = this.dashboard
  ) {
    if ((provider === "gitlab" || provider === "github") && !this.hasRepositorySelection) {
      return this.repositorySelectionMessage;
    }

    const providerData = dashboard?.providers?.[provider];
    if (!providerData?.configured) {
      return `${providerLabels[provider]} is not configured yet.`;
    }

    if (providerData.error && providerData.items.length === 0 && !providerData.repository) {
      return providerData.error;
    }

    return "";
  }

  private providerIsReady(provider: ProviderId, dashboard: DashboardData | null = this.dashboard) {
    return !this.providerAvailabilityErrorFor(provider, dashboard);
  }

  private canLoadProviderQueue(provider: ProviderId) {
    if (provider === "reviewboard") {
      return true;
    }

    return this.hasRepositorySelection;
  }

  private async applyRepositorySelection() {
    const input = this.repositoryUrlInput.trim();
    if (!input) {
      return;
    }

    const isUrl = input.startsWith("http://") || input.startsWith("https://");
    this.activeRepositoryUrl = isUrl ? input : "";
    this.activeRepositoryPath = isUrl ? "" : input;
    this.repositoryFormExpanded = false;

    // Auto-detect provider from URL and navigate to it
    if (isUrl) {
      const detected = this.detectProviderFromUrl(input);
      if (detected) {
        this.provider = detected;
      }
    }

    await this.loadInitialData({ preserveProvider: true });

    // Navigate to the provider section so the user sees results immediately
    this.activeSection = this.provider;
  }

  private detectProviderFromUrl(url: string): ProviderId | null {
    const lower = url.toLowerCase();

    // Check against configured GitHub URL (supports GitHub Enterprise)
    const githubBaseUrl = this.configDraft.githubUrl || this.dashboard?.config.github?.url || "";
    if (githubBaseUrl) {
      try {
        const githubHost = new URL(githubBaseUrl).hostname.toLowerCase();
        const inputHost = new URL(url).hostname.toLowerCase();
        if (inputHost === githubHost) {
          return "github";
        }
      } catch {
        // fall through
      }
    }

    if (lower.includes("github.com")) {
      return "github";
    }

    // Check against configured GitLab URL (supports self-hosted GitLab)
    const gitlabBaseUrl = this.configDraft.gitlabUrl || this.dashboard?.config.gitlab?.url || "";
    if (gitlabBaseUrl) {
      try {
        const gitlabHost = new URL(gitlabBaseUrl).hostname.toLowerCase();
        const inputHost = new URL(url).hostname.toLowerCase();
        if (inputHost === gitlabHost) {
          return "gitlab";
        }
      } catch {
        // fall through to string matching
      }
    }

    if (lower.includes("gitlab")) {
      return "gitlab";
    }

    return null;
  }

  private clearRepositorySelection() {
    this.activeRepositoryPath = "";
    this.activeRepositoryUrl = "";
    this.repositoryUrlInput = "";
    this.repositoryFormExpanded = false;
    this.targets = [];
    this.selectedTarget = null;
    this.detailTarget = null;
    this.targetsError = this.repositorySelectionMessage;
  }

  render() {
    const repositoryLabel =
      this.dashboard?.repository.remoteUrl?.replace(/\.git$/, "") ??
      this.dashboard?.repository.cwd ??
      "";
    const totalQueue = providerOrder.reduce(
      (count, provider) => count + (this.dashboard?.providers?.[provider]?.items.length ?? 0),
      0
    );
    const isLoading = this.loadingDashboard || this.loadingTargets || this.loadingConfig;

    return html`
      <div class="drawer lg:drawer-open min-h-screen" data-theme="dim">
        <input id="cr-drawer" type="checkbox" class="drawer-toggle" />

        <!-- Page content -->
        <div class="drawer-content flex flex-col min-h-screen bg-base-100">
          <!-- Top navbar -->
          <nav class="navbar sticky top-0 z-30 bg-base-200/95 backdrop-blur-sm border-b border-base-300 min-h-14 px-4 gap-3 lg:hidden">
            <label for="cr-drawer" class="btn btn-ghost btn-sm btn-square">
              <cr-icon .icon=${Menu} .size=${18}></cr-icon>
            </label>
            <span class="font-bold tracking-tight flex-1">CR Platform</span>
            ${isLoading ? html`<span class="loading loading-spinner loading-xs text-primary"></span>` : ""}
          </nav>

          <!-- Notice bar -->
          ${this.noticeMessage ? this.renderNoticeBar() : ""}

          <!-- Main content -->
          <main class="flex-1 p-4 lg:p-6 xl:p-8 max-w-screen-2xl mx-auto w-full">
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
          <aside class="bg-base-200 border-r border-base-300 w-72 min-h-full flex flex-col gap-4 p-4">
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
                <span>${totalQueue} open items</span>
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

            <!-- Repo selector at bottom -->
            <div class="mt-auto flex flex-col gap-2 border-t border-base-300 pt-4">
              ${this.renderSidebarRepoWidget()}
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

  private renderSidebarRepoWidget() {
    const hasActive = Boolean(this.activeRepositoryPath || this.activeRepositoryUrl);
    const activeLabel = this.activeRepositoryUrl || this.activeRepositoryPath;

    if (hasActive && !this.repositoryFormExpanded) {
      return html`
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="badge badge-success badge-xs gap-1">● connected</span>
            <button class="btn btn-ghost btn-xs text-error" type="button" @click=${() => this.clearRepositorySelection()}>Clear</button>
          </div>
          <div class="font-mono text-xs text-base-content/50 truncate">${activeLabel}</div>
          <button class="btn btn-ghost btn-xs w-full" type="button" @click=${() => { this.repositoryFormExpanded = true; }}>
            Change repo
          </button>
        </div>
      `;
    }

    return html`
      <form class="flex flex-col gap-2" @submit=${async (e: Event) => { e.preventDefault(); await this.applyRepositorySelection(); }}>
        <label class="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Repository</label>
        <input
          class="input input-bordered input-xs font-mono w-full"
          type="text"
          placeholder="github.com/owner/repo or /path"
          .value=${this.repositoryUrlInput}
          list="local-repos-list"
          @input=${(e: Event) => { this.repositoryUrlInput = (e.target as HTMLInputElement).value; }}
        />
        <datalist id="local-repos-list">
          ${this.localRepositories.map(r => html`<option value=${r}></option>`)}
        </datalist>
        <div class="flex gap-1">
          <button class="btn btn-primary btn-xs flex-1" type="submit" ?disabled=${!this.repositoryUrlInput.trim()}>
            Connect
          </button>
          ${hasActive ? html`<button class="btn btn-ghost btn-xs" type="button" @click=${() => { this.repositoryFormExpanded = false; }}>Cancel</button>` : ""}
        </div>
        ${
          this.localRepositories.length > 0
            ? html`<span class="text-xs text-base-content/30">${this.localRepositories.length} local repo${this.localRepositories.length === 1 ? "" : "s"} discovered</span>`
            : ""
        }
      </form>
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
    }
  }

  private iconForAnalysisTab(tab: AnalysisTab): IconNode {
    switch (tab) {
      case "review":
        return Bot;
      case "summary":
        return ScrollText;
      case "chat":
        return MessageSquare;
      case "comment":
        return MessageSquare;
    }
  }

  private renderRepositorySelector() {
    // The repo selector lives in the sidebar; this shows an inline form on pages that need it
    const hasActive = Boolean(this.activeRepositoryPath || this.activeRepositoryUrl);
    if (hasActive) return html``;
    return html`
      <div class="alert alert-info text-sm flex-wrap gap-3">
        <span class="flex-1">Connect a repository to load GitLab or GitHub review queues.</span>
        <label for="cr-drawer" class="btn btn-primary btn-sm lg:hidden">Open sidebar</label>
        <form class="hidden lg:flex gap-2 items-center" @submit=${async (e: Event) => { e.preventDefault(); await this.applyRepositorySelection(); }}>
          <input
            class="input input-bordered input-sm font-mono w-72"
            type="text"
            placeholder="github.com/owner/repo or /local/path"
            .value=${this.repositoryUrlInput}
            list="local-repos-list-inline"
            @input=${(e: Event) => { this.repositoryUrlInput = (e.target as HTMLInputElement).value; }}
          />
          <datalist id="local-repos-list-inline">
            ${this.localRepositories.map(r => html`<option value=${r}></option>`)}
          </datalist>
          <button class="btn btn-primary btn-sm" type="submit" ?disabled=${!this.repositoryUrlInput.trim()}>Connect</button>
        </form>
      </div>
    `;
  }

  private renderOverviewPage() {
    const configuredProviders = providerOrder.filter(
      (provider) => this.dashboard?.providers?.[provider]?.configured
    ).length;
    const queueSize = providerOrder.reduce(
      (count, provider) => count + (this.dashboard?.providers?.[provider]?.items.length ?? 0),
      0
    );
    const defaultAgents =
      this.dashboard?.config.defaultReviewAgents.length ?? this.selectedAgents.length ?? 0;
    const hasActive = Boolean(this.activeRepositoryPath || this.activeRepositoryUrl);

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

        <!-- Repo connect notice -->
        ${this.renderRepositorySelector()}

        ${
          hasActive ? html`
            <div class="alert alert-success text-sm">
              <span>
                <strong>Repository connected.</strong> ${this.activeRepositoryUrl || this.activeRepositoryPath}
              </span>
              <button class="btn btn-sm btn-ghost" type="button" @click=${() => this.handleSectionChange(this.provider)}>
                Open ${providerLabels[this.provider]} →
              </button>
            </div>
          ` : ""
        }

        <!-- Stats row -->
        <div class="stats stats-horizontal shadow w-full bg-base-200 border border-base-300 overflow-x-auto">
          <cr-stat-card
            .eyebrow=${"Configured providers"}
            .value=${`${configuredProviders}/3`}
            .note=${"GitLab, GitHub, and Review Board status"}
            .tone=${configuredProviders === providerOrder.length ? "success" : "accent"}
            .icon=${ShieldCheck}
          ></cr-stat-card>
          <cr-stat-card
            .eyebrow=${"Open review queue"}
            .value=${String(queueSize)}
            .note=${"Open items across all providers"}
            .tone=${queueSize > 0 ? "accent" : "default"}
            .icon=${Workflow}
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
            .value=${this.dashboard?.config.openai.model || "No model configured"}
            .note=${
              this.dashboard?.config.openai.configured
                ? this.dashboard?.config.openai.apiUrl || "OpenAI-compatible endpoint ready"
                : "Add model endpoint and key in Settings"
            }
          ></cr-config-card>
          <cr-config-card
            .label=${"Default review agents"}
            .value=${this.dashboard?.config.defaultReviewAgents.join(", ") || "general"}
            .note=${"Review profiles enabled for new workflow runs"}
          ></cr-config-card>
          <cr-config-card
            .label=${"Webhook runtime"}
            .value=${`${this.dashboard?.config.webhook.concurrency ?? 3} workers / ${this.dashboard?.config.webhook.queueLimit ?? 50} queue`}
            .note=${`Timeout ${this.dashboard?.config.webhook.jobTimeoutMs ?? 600000} ms${this.dashboard?.config.webhook.sslEnabled ? " · SSL enabled" : ""}`}
          ></cr-config-card>
        </div>
      </div>
    `;
  }

  private renderProviderSummaryCard(provider: ProviderId) {
    const data = this.dashboard?.providers?.[provider];
    const label = providerLabels[provider];

    return html`
      <div class="card bg-base-200 border border-base-300 shadow-sm">
        <div class="card-body gap-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-1 flex items-center gap-1.5">
                <cr-icon .icon=${this.iconForSection(provider)} .size=${12}></cr-icon>
                ${label}
              </div>
              <div class="text-3xl font-bold tracking-tight">${data?.items.length ?? 0}</div>
            </div>
            <div class="badge ${data?.configured ? "badge-success" : "badge-error"} badge-sm shrink-0">
              ${data?.configured ? "✓ configured" : "✗ missing"}
            </div>
          </div>
          <p class="text-sm text-base-content/50 line-clamp-2 min-h-[2.5rem]">
            ${data?.repository || data?.error || "No repository context loaded for this provider."}
          </p>
          <div class="card-actions">
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
      </div>
    `;
  }

  private renderProviderPage() {
    const label = providerLabels[this.provider];
    const detail = this.detailTarget;
    const hasRepo = this.hasRepositorySelection;
    const providerError = this.providerAvailabilityError;

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
      <div class="flex flex-col gap-4">
        <!-- Repo connect notice (for gitlab/github without repo) -->
        ${this.renderRepositorySelector()}

        ${
          hasRepo || this.provider === "reviewboard"
            ? html`
              <!-- Stats row -->
              <div class="stats stats-horizontal shadow w-full bg-base-200 border border-base-300 overflow-x-auto">
                <cr-stat-card
                  .eyebrow=${`${label} queue`}
                  .value=${String(this.targets.length)}
                  .note=${`${this.stateFilter} requests loaded`}
                  .tone=${this.targets.length > 0 ? "accent" : "default"}
                  .icon=${FolderSearch}
                ></cr-stat-card>
                <cr-stat-card
                  .eyebrow=${"Selected agents"}
                  .value=${String(this.selectedAgents.length || 1)}
                  .note=${"Profiles ready for review"}
                  .icon=${BrainCircuit}
                ></cr-stat-card>
                <cr-stat-card
                  .eyebrow=${"Diff workspace"}
                  .value=${String(detail ? this.diffFiles.length : 0)}
                  .note=${detail ? detail.title : "Choose a request to inspect"}
                  .tone=${detail ? "success" : "default"}
                  .icon=${FileDiff}
                ></cr-stat-card>
              </div>

              ${providerError ? html`<div class="alert alert-warning text-sm">${providerError}</div>` : ""}

              <!-- 3-column workspace -->
              <div class="grid grid-cols-1 xl:grid-cols-[320px_1fr_360px] gap-4">
                <!-- Review queue rail -->
                <div class="card bg-base-200 border border-base-300">
                  <div class="card-body gap-3 p-4">
                    <div class="flex items-center justify-between gap-2">
                      <div>
                        <div class="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-0.5">${label}</div>
                        <h2 class="text-base font-bold">Review queue</h2>
                      </div>
                      <div class="badge badge-primary badge-sm">${this.stateFilter}</div>
                    </div>

                    <!-- State filter tabs -->
                    <div class="tabs tabs-boxed bg-base-300 p-0.5 gap-0">
                      ${reviewStates.map(
                        (state) => html`
                          <button
                            type="button"
                            class="tab tab-sm ${this.stateFilter === state ? "tab-active" : ""}"
                            @click=${() => this.handleStateChange(state)}
                          >
                            ${state}
                          </button>
                        `
                      )}
                    </div>

                    <!-- Search -->
                    <label class="input input-bordered input-sm flex items-center gap-2 w-full">
                      <cr-icon .icon=${Search} .size=${14}></cr-icon>
                      <input
                        type="search"
                        class="grow text-xs"
                        placeholder="Search id, title, author, branch"
                        .value=${this.searchTerm}
                        @input=${(e: Event) => { this.searchTerm = (e.target as HTMLInputElement).value; }}
                      />
                    </label>

                    <cr-review-list
                      .provider=${this.provider}
                      .targets=${this.filteredTargets}
                      .selectedId=${this.selectedTarget?.id ?? 0}
                      .loading=${this.loadingTargets}
                      .error=${this.targetsError}
                      .configured=${this.configured}
                      @review-selected=${this.handleTargetSelected}
                    ></cr-review-list>
                  </div>
                </div>

                <!-- Diff / detail panel -->
                <div class="card bg-base-200 border border-base-300 min-h-[60vh]">
                  <div class="card-body gap-3 p-4 min-h-0">
                    ${
                      detail
                        ? html`
                          <!-- Detail header -->
                          <div class="flex items-start justify-between gap-2 flex-wrap">
                            <div class="flex flex-col gap-1 min-w-0">
                              <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">${label} review</div>
                              <h2 class="text-base font-bold leading-snug">
                                <span class="font-mono text-primary text-sm">${detail.provider === "gitlab" ? `!${detail.id}` : `#${detail.id}`}</span>
                                ${detail.title}
                              </h2>
                              <div class="flex flex-wrap gap-1.5 mt-1">
                                ${detail.state ? html`<span class="badge badge-sm badge-ghost">${detail.state}</span>` : ""}
                                ${detail.author ? html`<span class="badge badge-sm badge-ghost">${detail.author}</span>` : ""}
                                ${detail.sourceBranch ? html`<span class="badge badge-sm badge-ghost font-mono">${detail.sourceBranch}${detail.targetBranch ? ` → ${detail.targetBranch}` : ""}</span>` : ""}
                                ${detail.updatedAt ? html`<span class="badge badge-sm badge-ghost">${detail.updatedAt}</span>` : ""}
                              </div>
                            </div>
                            ${detail.url ? html`<a class="btn btn-ghost btn-xs shrink-0" href=${detail.url} target="_blank" rel="noreferrer">↗ Open</a>` : ""}
                          </div>

                          <!-- Workspace tabs -->
                          <div class="tabs tabs-boxed bg-base-300 p-0.5 gap-0 self-start">
                            ${(["overview", "diff", "commits"] as WorkspaceTab[]).map(
                              (tab) => html`
                                <button
                                  type="button"
                                  class="tab tab-sm ${this.workspaceTab === tab ? "tab-active" : ""} gap-1.5"
                                  @click=${() => { this.workspaceTab = tab; }}
                                >
                                  <cr-icon .icon=${this.iconForWorkspaceTab(tab)} .size=${13}></cr-icon>
                                  ${tab}
                                </button>
                              `
                            )}
                          </div>

                          <div class="flex-1 min-h-0 overflow-auto">
                            ${
                              this.detailError
                                ? html`<div class="alert alert-error text-sm">${this.detailError}</div>`
                                : this.loadingDetail
                                  ? html`<div class="flex items-center gap-2 p-4 text-base-content/50 text-sm"><span class="loading loading-spinner loading-xs"></span> Loading…</div>`
                                  : this.workspaceTab === "overview"
                                    ? this.renderOverview(detail)
                                    : this.workspaceTab === "commits"
                                      ? this.renderCommits()
                                      : html`
                                        <cr-diff-viewer
                                          .files=${this.diffFiles}
                                          .selectedFileId=${this.selectedFileId}
                                          .selectedPatch=${this.selectedFilePatch}
                                          .selectedLineKey=${this.selectedLine?.key || ""}
                                          .loading=${this.loadingDiffPatch}
                                          .error=${this.detailError}
                                          @file-selected=${this.handleFileSelected}
                                          @line-selected=${this.handleLineSelected}
                                        ></cr-diff-viewer>
                                      `
                            }
                          </div>
                        `
                        : html`
                          <div class="flex flex-col items-center justify-center h-full gap-3 text-base-content/40 py-12">
                            <cr-icon .icon=${FolderSearch} .size=${32}></cr-icon>
                            <p class="text-sm text-center max-w-xs">Select a review request from the queue to open this workspace.</p>
                          </div>
                        `
                    }
                  </div>
                </div>

                <!-- Analysis panel -->
                <div class="card bg-base-200 border border-base-300">
                  <div class="card-body gap-3 p-4">
                    <div class="flex items-center justify-between gap-2">
                      <div>
                        <div class="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-0.5">AI</div>
                        <h2 class="text-base font-bold">Action rail</h2>
                      </div>
                      ${detail ? html`<div class="badge badge-primary badge-sm">${label}</div>` : ""}
                    </div>

                    <!-- Analysis tabs -->
                    <div class="tabs tabs-boxed bg-base-300 p-0.5 gap-0">
                      ${(["review", "summary", "chat", "comment"] as AnalysisTab[]).map(
                        (tab) => html`
                          <button
                            type="button"
                            class="tab tab-sm ${this.analysisTab === tab ? "tab-active" : ""}"
                            @click=${async () => {
                              this.analysisTab = tab;
                              if (tab === "chat") await this.ensureChatContext();
                            }}
                          >
                            ${tab}
                          </button>
                        `
                      )}
                    </div>

                    <div class="flex-1 min-h-0 overflow-auto flex flex-col gap-3">
                      ${
                        !detail
                          ? html`<div class="alert text-sm">Open a request before running AI workflows.</div>`
                          : this.analysisTab === "review"
                            ? this.renderReviewPanel()
                            : this.analysisTab === "summary"
                              ? this.renderSummaryPanel()
                              : this.analysisTab === "chat"
                                ? this.renderChatPanel()
                                : this.renderCommentPanel()
                      }
                    </div>
                  </div>
                </div>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  private renderSettingsPage() {
    const gitlabConfigured = this.dashboard?.config.gitlab?.configured;
    const githubConfigured = this.dashboard?.config.github?.configured;
    const reviewBoardConfigured = this.dashboard?.config.reviewboard?.configured;

    return html`
      <div class="flex flex-col gap-6 pb-24">
        <!-- Page header -->
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
          <p class="text-base-content/50 text-sm mt-1">Configure providers, AI runtime, webhooks, and server options.</p>
        </div>

        <!-- Stats row -->
        <div class="stats stats-horizontal shadow w-full bg-base-200 border border-base-300 overflow-x-auto">
          <cr-stat-card
            .eyebrow=${"AI runtime"}
            .value=${this.dashboard?.config.openai.model || "Not configured"}
            .note=${this.dashboard?.config.openai.configured ? "Model endpoint ready" : "Add API settings to enable AI"}
            .tone=${this.dashboard?.config.openai.configured ? "success" : "accent"}
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
            .value=${this.configDraft.terminalTheme || "auto"}
            .note=${"CLI and server terminal rendering"}
            .icon=${Waypoints}
          ></cr-stat-card>
        </div>

        <!-- AI & Defaults card -->
        <div class="card bg-base-200 border border-base-300">
          <div class="card-body gap-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="card-title text-base gap-2">
                <cr-icon .icon=${BrainCircuit} .size=${16}></cr-icon>
                AI and defaults
              </h3>
              <div class="badge ${this.dashboard?.config.openai.configured ? "badge-success" : "badge-error"} badge-sm">
                ${this.dashboard?.config.openai.configured ? "ready" : "needs setup"}
              </div>
            </div>
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
                  <option value="">auto</option>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </select>
              </div>
            </div>
            <div class="flex items-center justify-between gap-2 mt-1">
              <div></div>
              <button
                class="btn btn-outline btn-xs gap-1.5"
                type="button"
                ?disabled=${this.testResults["openai"]?.testing}
                @click=${() => this.handleTestConnection("openai")}
              >
                ${this.testResults["openai"]?.testing ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                Test connection
              </button>
            </div>
            ${this.testResults["openai"] && !this.testResults["openai"].testing ? html`
              <div class="alert ${this.testResults["openai"].ok ? "alert-success" : "alert-error"} py-2 text-sm">
                ${this.testResults["openai"].ok ? "✓" : "✗"} ${this.testResults["openai"].message}
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
          </div>
        </div>

        <!-- Provider connections -->
        <div class="card bg-base-200 border border-base-300">
          <div class="card-body gap-4">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <h3 class="card-title text-base gap-2">
                <cr-icon .icon=${GitBranch} .size=${16}></cr-icon>
                Source connections
              </h3>
              <div class="flex gap-1.5 flex-wrap">
                <span class="badge ${gitlabConfigured ? "badge-success" : "badge-error"} badge-sm">GitLab</span>
                <span class="badge ${githubConfigured ? "badge-success" : "badge-error"} badge-sm">GitHub</span>
                <span class="badge ${reviewBoardConfigured ? "badge-success" : "badge-error"} badge-sm">Review Board</span>
              </div>
            </div>

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
                ?disabled=${this.testResults["gitlab"]?.testing}
                @click=${() => this.handleTestConnection("gitlab")}
              >
                ${this.testResults["gitlab"]?.testing ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                Test connection
              </button>
            </div>
            ${this.testResults["gitlab"] && !this.testResults["gitlab"].testing ? html`
              <div class="alert ${this.testResults["gitlab"].ok ? "alert-success" : "alert-error"} py-2 text-sm">
                ${this.testResults["gitlab"].ok ? "✓" : "✗"} ${this.testResults["gitlab"].message}
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
                ?disabled=${this.testResults["github"]?.testing}
                @click=${() => this.handleTestConnection("github")}
              >
                ${this.testResults["github"]?.testing ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                Test connection
              </button>
            </div>
            ${this.testResults["github"] && !this.testResults["github"].testing ? html`
              <div class="alert ${this.testResults["github"].ok ? "alert-success" : "alert-error"} py-2 text-sm">
                ${this.testResults["github"].ok ? "✓" : "✗"} ${this.testResults["github"].message}
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
                ?disabled=${this.testResults["reviewboard"]?.testing}
                @click=${() => this.handleTestConnection("reviewboard")}
              >
                ${this.testResults["reviewboard"]?.testing ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
                Test connection
              </button>
            </div>
            ${this.testResults["reviewboard"] && !this.testResults["reviewboard"].testing ? html`
              <div class="alert ${this.testResults["reviewboard"].ok ? "alert-success" : "alert-error"} py-2 text-sm">
                ${this.testResults["reviewboard"].ok ? "✓" : "✗"} ${this.testResults["reviewboard"].message}
              </div>` : ""}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${this.renderConfigInput({ label: "Review Board URL", note: "Base URL for review request and diff APIs.", value: this.configDraft.rbUrl, onInput: (v) => this.handleConfigField("rbUrl", v) })}
              ${this.renderConfigInput({ label: "Review Board token", note: "Token for review publishing and queue access.", value: this.configDraft.rbToken, type: "password", onInput: (v) => this.handleConfigField("rbToken", v) })}
            </div>
          </div>
        </div>

        <!-- Webhooks -->
        <div class="card bg-base-200 border border-base-300">
          <div class="card-body gap-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="card-title text-base gap-2">
                <cr-icon .icon=${Webhook} .size=${16}></cr-icon>
                Webhooks &amp; queueing
              </h3>
              <div class="badge ${this.dashboard?.config.webhook.sslEnabled ? "badge-success" : "badge-ghost"} badge-sm">
                ${this.dashboard?.config.webhook.sslEnabled ? "SSL enabled" : "HTTP only"}
              </div>
            </div>
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
          </div>
        </div>
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
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div class="card bg-base-300 border border-base-100/10">
          <div class="card-body gap-2">
            <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Request summary</div>
            <p class="text-sm text-base-content/60">
              ${detail.description || detail.summary || "No rich description from the provider. Use the diff and commit tabs for full review context."}
            </p>
          </div>
        </div>
        <div class="card bg-base-300 border border-base-100/10">
          <div class="card-body gap-3">
            <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Workspace stats</div>
            <div class="flex flex-wrap gap-2">
              <span class="badge badge-ghost badge-sm">${this.diffFiles.length} changed files</span>
              <span class="badge badge-ghost badge-sm">${this.commits.length} commits</span>
              <span class="badge badge-ghost badge-sm">${this.reviewResult?.inlineComments.length ?? 0} AI inline notes</span>
            </div>
          </div>
        </div>
        <div class="card bg-base-300 border border-base-100/10">
          <div class="card-body gap-2">
            <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Workflow availability</div>
            <div class="text-xs text-base-content/60">
              ${
                detail.provider === "reviewboard"
                  ? "Review Board can receive summary review posts. Inline comments are disabled in this workspace."
                  : "GitLab and GitHub support AI review posts plus manual inline comments from the diff viewer."
              }
            </div>
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
          <div class="card card-compact bg-base-300 border border-base-100/10">
            <div class="card-body gap-1">
              <div class="font-semibold text-sm">${commit.title}</div>
              <div class="font-mono text-xs text-base-content/40">${commit.id}</div>
              <div class="text-xs text-base-content/50">${commit.author || "Unknown author"}${commit.createdAt ? ` · ${commit.createdAt}` : ""}</div>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderReviewPanel() {
    return html`
      ${!this.canRunLocalWorkflows ? html`
        <div class="alert alert-warning text-xs">AI review requires a local checkout. Switch the repo source to a local path to enable this workflow.</div>
      ` : ""}

      <div class="card bg-base-300 border border-base-100/10">
        <div class="card-body gap-4">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Agent selection</div>
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

          <div class="flex flex-col gap-2">
            ${this.agentOptions.map(option => html`
              <label class="cursor-pointer flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors
                ${this.selectedAgents.includes(option.value) ? "border-primary/40 bg-primary/10" : "border-base-100/10 hover:border-base-content/20"}">
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
            <label class="label py-0"><span class="label-text text-xs">Regenerate with feedback</span></label>
            <textarea
              class="textarea textarea-bordered textarea-sm text-sm"
              rows="3"
              placeholder="Focus on performance, security, or a specific subsystem"
              .value=${this.feedbackDraft}
              @input=${(e: Event) => { this.feedbackDraft = (e.target as HTMLTextAreaElement).value; }}
            ></textarea>
          </div>

          <div class="flex gap-2 flex-wrap">
            <button
              class="btn btn-primary btn-sm flex-1 gap-1.5"
              type="button"
              ?disabled=${!this.canRunLocalWorkflows || this.runningReview || this.selectedAgents.length === 0}
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
      </div>

      ${this.reviewWarnings.map(w => html`<div class="alert alert-warning text-xs">${w}</div>`)}

      ${this.reviewResult ? html`
        <div class="card bg-base-300 border border-base-100/10">
          <div class="card-body gap-3">
            <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Aggregated result</div>
            <p class="text-sm text-base-content/70">${this.reviewResult.overallSummary || this.reviewResult.output}</p>
          </div>
        </div>

        ${this.reviewResult.inlineComments.length > 0 ? html`
          <div class="card bg-base-300 border border-base-100/10">
            <div class="card-body gap-3">
              <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Inline candidates (${this.reviewResult.inlineComments.length})</div>
              <div class="flex flex-col gap-2">
                ${this.reviewResult.inlineComments.map(c => html`
                  <div class="border border-base-100/10 rounded-lg p-2.5 flex flex-col gap-1">
                    <div class="font-mono text-xs text-primary">${c.filePath}:${c.line}</div>
                    <p class="text-xs text-base-content/60">${c.comment}</p>
                  </div>
                `)}
              </div>
            </div>
          </div>
        ` : ""}

        ${this.reviewResult.agentResults?.length ? html`
          <div class="card bg-base-300 border border-base-100/10">
            <div class="card-body gap-3">
              <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Per-agent output</div>
              <div class="flex flex-col gap-2">
                ${this.reviewResult.agentResults.map(a => html`
                  <div class="border border-base-100/10 rounded-lg p-2.5 flex flex-col gap-1">
                    <div class="font-semibold text-xs">${a.name}</div>
                    <p class="text-xs text-base-content/60">${a.failed ? a.error || "Agent failed." : a.output}</p>
                  </div>
                `)}
              </div>
            </div>
          </div>
        ` : ""}
      ` : ""}
    `;
  }

  private renderSummaryPanel() {
    return html`
      ${!this.canRunLocalWorkflows ? html`
        <div class="alert alert-warning text-xs">Summary generation needs a local checkout to load repository context.</div>
      ` : ""}
      <div class="card bg-base-300 border border-base-100/10">
        <div class="card-body gap-3">
          <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Generate summary</div>
          <button
            class="btn btn-primary btn-sm gap-1.5"
            type="button"
            ?disabled=${!this.canRunLocalWorkflows || this.runningSummary}
            @click=${async () => this.handleRunSummary()}
          >
            ${this.runningSummary ? html`<span class="loading loading-spinner loading-xs"></span>` : html`<cr-icon .icon=${ScrollText} .size=${14}></cr-icon>`}
            ${this.runningSummary ? "Generating…" : "Generate summary"}
          </button>
        </div>
      </div>

      ${this.summaryResult ? html`
        <div class="card bg-base-300 border border-base-100/10">
          <div class="card-body gap-2">
            <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Summary output</div>
            <p class="text-sm text-base-content/70">${this.summaryResult.output}</p>
          </div>
        </div>
      ` : ""}
    `;
  }

  private renderChatPanel() {
    return html`
      ${!this.canRunLocalWorkflows ? html`
        <div class="alert alert-warning text-xs">Review chat is available only with a local checkout selected.</div>
      ` : ""}

      ${this.chatContext ? html`
        <div class="card bg-base-300 border border-base-100/10">
          <div class="card-body gap-2">
            <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Chat context</div>
            <p class="text-xs text-base-content/60">${this.chatContext.summary}</p>
          </div>
        </div>
      ` : html`
        <div class="card bg-base-300 border border-base-100/10">
          <div class="card-body gap-3">
            <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Prepare context</div>
            <button
              class="btn btn-primary btn-sm gap-1.5"
              type="button"
              ?disabled=${!this.canRunLocalWorkflows || this.loadingChat}
              @click=${async () => this.ensureChatContext()}
            >
              ${this.loadingChat ? html`<span class="loading loading-spinner loading-xs"></span>` : html`<cr-icon .icon=${MessageSquare} .size=${14}></cr-icon>`}
              ${this.loadingChat ? "Preparing…" : "Load chat context"}
            </button>
          </div>
        </div>
      `}

      ${this.chatHistory.length > 0 ? html`
        <div class="flex flex-col gap-2">
          ${this.chatHistory.flatMap(entry => [
            html`<div class="chat chat-end"><div class="chat-bubble chat-bubble-primary text-sm">${entry.question}</div></div>`,
            html`<div class="chat chat-start"><div class="chat-bubble bg-base-300 text-base-content text-sm">${entry.answer}</div></div>`,
          ])}
        </div>
      ` : ""}

      <div class="card bg-base-300 border border-base-100/10">
        <div class="card-body gap-3">
          <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Ask a question</div>
          <textarea
            class="textarea textarea-bordered textarea-sm text-sm"
            rows="3"
            placeholder="Ask about risks, test gaps, branch intent, or suspicious changes"
            .value=${this.chatQuestion}
            @input=${(e: Event) => { this.chatQuestion = (e.target as HTMLTextAreaElement).value; }}
            @keydown=${async (e: KeyboardEvent) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) await this.handleAskQuestion(); }}
          ></textarea>
          <button
            class="btn btn-primary btn-sm gap-1.5"
            type="button"
            ?disabled=${!this.canRunLocalWorkflows || this.loadingChat || !this.chatContext || !this.chatQuestion.trim()}
            @click=${async () => this.handleAskQuestion()}
          >
            ${this.loadingChat ? html`<span class="loading loading-spinner loading-xs"></span>` : html`<cr-icon .icon=${MessageSquare} .size=${14}></cr-icon>`}
            ${this.loadingChat ? "Thinking…" : "Ask"}
          </button>
        </div>
      </div>
    `;
  }

  private renderCommentPanel() {
    const reviewBoardInlineDisabled = this.selectedTarget?.provider === "reviewboard";

    return html`
      <div class="card bg-base-300 border border-base-100/10">
        <div class="card-body gap-3">
          <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Summary comment</div>
          <textarea
            class="textarea textarea-bordered textarea-sm text-sm"
            rows="4"
            placeholder="Write a provider comment or paste/edit the generated review before posting"
            .value=${this.summaryDraft}
            @input=${(e: Event) => { this.summaryDraft = (e.target as HTMLTextAreaElement).value; }}
          ></textarea>
          <div class="flex gap-2 flex-wrap">
            <button
              class="btn btn-primary btn-sm flex-1 gap-1.5"
              type="button"
              ?disabled=${this.postingSummary || !this.summaryDraft.trim()}
              @click=${async () => this.handlePostSummaryComment()}
            >
              ${this.postingSummary ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
              Post summary
            </button>
            ${this.reviewResult ? html`
              <button class="btn btn-ghost btn-sm" type="button" @click=${() => { this.summaryDraft = this.reviewResult?.overallSummary || this.reviewResult?.output || ""; }}>
                Copy generated
              </button>
            ` : ""}
          </div>
        </div>
      </div>

      <div class="card bg-base-300 border border-base-100/10">
        <div class="card-body gap-3">
          <div class="text-xs font-bold uppercase tracking-widest text-base-content/40">Inline comment</div>
          ${
            this.selectedLine
              ? html`
                <div class="rounded-lg bg-primary/10 border border-primary/30 p-2.5 text-xs flex flex-col gap-1">
                  <span class="font-mono text-primary">${this.selectedLine.filePath}:${this.selectedLine.line} (${this.selectedLine.positionType})</span>
                  <span class="font-mono text-base-content/50 truncate">${this.selectedLine.text}</span>
                </div>
              `
              : html`<div class="text-xs text-base-content/40 italic">Choose a line in the diff view to anchor an inline comment.</div>`
          }
          ${reviewBoardInlineDisabled ? html`<div class="alert alert-warning text-xs">Review Board inline comments are not enabled here. Use a summary comment instead.</div>` : ""}
          <textarea
            class="textarea textarea-bordered textarea-sm text-sm"
            rows="3"
            placeholder="Write a precise inline note"
            .value=${this.inlineDraft}
            @input=${(e: Event) => { this.inlineDraft = (e.target as HTMLTextAreaElement).value; }}
          ></textarea>
          <button
            class="btn btn-primary btn-sm gap-1.5"
            type="button"
            ?disabled=${this.postingInline || reviewBoardInlineDisabled || !this.selectedLine || !this.inlineDraft.trim()}
            @click=${async () => this.handlePostInlineComment()}
          >
            ${this.postingInline ? html`<span class="loading loading-spinner loading-xs"></span>` : ""}
            Post inline
          </button>
        </div>
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
