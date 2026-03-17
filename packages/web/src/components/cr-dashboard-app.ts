import { LitElement, css, html } from "lit";
import {
  answerChatQuestion,
  loadChatContext,
  loadDashboard,
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
} from "../api.js";
import { dashboardThemeStyles } from "../styles.js";
import {
  providerOrder,
  reviewStates,
  type DashboardData,
  type ProviderId,
  type ReviewAgentOption,
  type ReviewChatContext,
  type ReviewChatHistoryEntry,
  type ReviewCommit,
  type ReviewDiffFile,
  type ReviewState,
  type ReviewTarget,
  type ReviewWorkflowResult,
} from "../types.js";
import "./cr-dashboard-header.js";
import "./cr-diff-viewer.js";
import "./cr-review-list.js";

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

export class CrDashboardApp extends LitElement {
  static properties = {
    dashboard: { state: true },
    agentOptions: { state: true },
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
    noticeMessage: { state: true },
    noticeTone: { state: true },
    loadingDashboard: { state: true },
    loadingTargets: { state: true },
    loadingDetail: { state: true },
    loadingDiffPatch: { state: true },
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

  static styles = [
    dashboardThemeStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(217, 118, 18, 0.1), transparent 26rem),
          radial-gradient(circle at top right, rgba(44, 106, 83, 0.08), transparent 24rem),
          linear-gradient(180deg, #f7f1e7 0%, #efe5d5 100%);
      }

      main {
        display: grid;
        gap: 24px;
        max-width: 1600px;
        margin: 0 auto;
        padding: 28px;
      }

      .layout {
        display: grid;
        grid-template-columns: 340px minmax(0, 1fr) 360px;
        gap: 20px;
        min-height: calc(100vh - 220px);
      }

      .rail,
      .detail,
      .analysis {
        display: grid;
        align-content: start;
        gap: 16px;
        min-height: 0;
      }

      .rail-panel,
      .detail-panel,
      .analysis-panel {
        display: grid;
        gap: 16px;
        min-height: 0;
        padding: 18px;
        border-radius: 24px;
      }

      .rail-panel {
        grid-template-rows: auto auto auto minmax(0, 1fr);
      }

      .detail-panel {
        grid-template-rows: auto auto minmax(0, 1fr);
      }

      .analysis-panel {
        grid-template-rows: auto auto minmax(0, 1fr);
      }

      .toolbar,
      .toolbar-stack {
        display: grid;
        gap: 12px;
      }

      .segmented {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .segmented button {
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.75);
        color: var(--ink-soft);
        cursor: pointer;
      }

      .segmented button[data-active="true"] {
        border-color: var(--accent-strong);
        background: var(--accent);
        color: white;
      }

      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .search {
        width: 100%;
      }

      .summary-grid,
      .overview-grid {
        display: grid;
        gap: 14px;
      }

      .summary-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .metric {
        display: grid;
        gap: 6px;
        padding: 16px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid var(--line);
      }

      .metric strong {
        font-size: 1.4rem;
      }

      .detail-header {
        display: grid;
        gap: 14px;
      }

      .detail-header-top {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
      }

      .detail-title {
        display: grid;
        gap: 8px;
      }

      .detail-title h2 {
        font-size: clamp(1.6rem, 3vw, 2.4rem);
        line-height: 1.02;
      }

      .detail-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .link {
        color: inherit;
        text-decoration: none;
      }

      .link:hover {
        text-decoration: underline;
      }

      .detail-body,
      .analysis-body {
        display: grid;
        gap: 14px;
        min-height: 0;
      }

      .detail-scroll,
      .analysis-scroll {
        display: grid;
        gap: 14px;
        min-height: 0;
        overflow: auto;
        padding-right: 2px;
      }

      .card {
        display: grid;
        gap: 12px;
        padding: 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.82);
      }

      .agent-list,
      .stack {
        display: grid;
        gap: 10px;
      }

      .agent-card {
        display: grid;
        gap: 8px;
        padding: 14px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.74);
      }

      .agent-card[data-active="true"] {
        border-color: rgba(217, 118, 18, 0.24);
        background: rgba(255, 247, 237, 0.95);
      }

      .agent-card label {
        display: grid;
        gap: 8px;
        cursor: pointer;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .outputs {
        display: grid;
        gap: 12px;
      }

      .inline-item {
        padding: 12px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.72);
      }

      .chat-thread {
        display: grid;
        gap: 10px;
      }

      .chat-turn {
        display: grid;
        gap: 8px;
        padding: 12px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.74);
      }

      .chat-turn[data-role="assistant"] {
        background: rgba(255, 247, 237, 0.8);
      }

      .commit-list {
        display: grid;
        gap: 12px;
      }

      .commit {
        display: grid;
        gap: 6px;
        padding: 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.75);
      }

      .mobile-only {
        display: none;
      }

      @media (max-width: 1240px) {
        .layout {
          grid-template-columns: 320px minmax(0, 1fr);
        }

        .analysis {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 920px) {
        main {
          padding: 18px;
        }

        .layout {
          grid-template-columns: 1fr;
        }

        .summary-grid {
          grid-template-columns: 1fr;
        }

        .mobile-only {
          display: block;
        }
      }
    `,
  ];

  declare dashboard: DashboardData | null;
  declare agentOptions: ReviewAgentOption[];
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
  declare noticeMessage: string;
  declare noticeTone: NoticeTone;
  declare loadingDashboard: boolean;
  declare loadingTargets: boolean;
  declare loadingDetail: boolean;
  declare loadingDiffPatch: boolean;
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
    this.noticeMessage = "";
    this.noticeTone = "success";
    this.loadingDashboard = false;
    this.loadingTargets = false;
    this.loadingDetail = false;
    this.loadingDiffPatch = false;
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
    void this.loadInitialData();
  }

  private async loadInitialData() {
    this.loadingDashboard = true;
    this.targetsError = "";
    try {
      const [dashboard, agentOptions] = await Promise.all([loadDashboard(), loadReviewAgents()]);
      this.dashboard = dashboard;
      this.agentOptions = agentOptions;
      this.selectedAgents = agentOptions.filter((option) => option.selected).map((option) => option.value);

      const firstConfiguredProvider =
        providerOrder.find((provider) => dashboard.providers?.[provider]?.configured) ?? this.provider;
      this.provider = firstConfiguredProvider;

      await this.loadTargets();
    } catch (error) {
      this.targetsError = this.toMessage(error);
    } finally {
      this.loadingDashboard = false;
    }
  }

  private async refreshAll() {
    await this.loadInitialData();
    this.setNotice("Workspace refreshed from the latest provider state.", "success");
  }

  private async loadTargets() {
    this.loadingTargets = true;
    this.targetsError = "";
    this.targets = [];
    this.selectedTarget = null;
    this.detailTarget = null;
    this.resetWorkspaceState();

    try {
      const targets = await loadReviewTargets(this.provider, this.stateFilter);
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
        loadReviewDetail(target.provider, target.id),
        loadReviewDiffs(target.provider, target.id),
        loadReviewCommits(target.provider, target.id),
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
        const patch = await loadReviewBoardFilePatch(this.selectedTarget.id, file.diffSetId, file.fileDiffId);
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

  private async handleProviderChange(provider: ProviderId) {
    if (provider === this.provider) {
      return;
    }
    this.provider = provider;
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

  private get configured() {
    return this.dashboard?.providers?.[this.provider]?.configured ?? true;
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

  render() {
    const repositoryLabel =
      this.dashboard?.repository.remoteUrl?.replace(/\.git$/, "") ?? this.dashboard?.repository.cwd ?? "";
    const detail = this.detailTarget;

    return html`
      <main>
        <cr-dashboard-header
          .generatedAt=${this.dashboard?.generatedAt || ""}
          .loading=${this.loadingDashboard || this.loadingTargets}
          .repositoryLabel=${this.provider}
          .repositoryPath=${repositoryLabel}
          .remoteUrl=${this.dashboard?.repository.remoteUrl || ""}
          @refresh=${() => this.refreshAll()}
        ></cr-dashboard-header>

        ${this.noticeMessage
          ? html`<div class="notice" data-tone=${this.noticeTone}>${this.noticeMessage}</div>`
          : ""}

        <div class="summary-grid">
          <section class="metric panel">
            <span class="eyebrow">queue size</span>
            <strong>${this.targets.length}</strong>
            <span class="muted">${this.provider} requests for ${this.stateFilter}</span>
          </section>
          <section class="metric panel">
            <span class="eyebrow">agents</span>
            <strong>${this.selectedAgents.length || this.agentOptions.filter((option) => option.selected).length || 1}</strong>
            <span class="muted">default review profiles active</span>
          </section>
          <section class="metric panel">
            <span class="eyebrow">workspace</span>
            <strong>${detail ? (this.workspaceTab === "diff" ? this.diffFiles.length : this.commits.length) : 0}</strong>
            <span class="muted">${detail ? detail.title : "Choose a target to begin"}</span>
          </section>
        </div>

        <div class="layout">
          <section class="rail">
            <div class="rail-panel panel">
              <div class="section-head">
                <div>
                  <div class="eyebrow">Review inbox</div>
                  <h2>Review queue</h2>
                </div>
                ${this.configured
                  ? html`<div class="badge" data-tone="success">configured</div>`
                  : html`<div class="badge" data-tone="danger">missing config</div>`}
              </div>

              <div class="toolbar">
                <div class="segmented">
                  ${providerOrder.map(
                    (provider) => html`
                      <button
                        type="button"
                        data-active=${String(this.provider === provider)}
                        @click=${() => this.handleProviderChange(provider)}
                      >
                        ${provider}
                      </button>
                    `
                  )}
                </div>

                <div class="segmented">
                  ${reviewStates.map(
                    (state) => html`
                      <button
                        type="button"
                        data-active=${String(this.stateFilter === state)}
                        @click=${() => this.handleStateChange(state)}
                      >
                        ${state}
                      </button>
                    `
                  )}
                </div>
              </div>

              <input
                class="field search"
                type="search"
                placeholder="Search id, title, author, branch"
                .value=${this.searchTerm}
                @input=${(event: Event) => {
                  this.searchTerm = (event.target as HTMLInputElement).value;
                }}
              />

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
          </section>

          <section class="detail">
            <div class="detail-panel panel">
              ${detail
                ? html`
                    <div class="detail-header">
                      <div class="detail-header-top">
                        <div class="detail-title">
                          <div class="eyebrow">Desktop review detail workspace</div>
                          <h2>
                            ${detail.provider === "gitlab" ? `!${detail.id}` : `#${detail.id}`}
                            ${detail.title}
                          </h2>
                        </div>
                        ${detail.url
                          ? html`
                              <a class="button link" href=${detail.url} target="_blank" rel="noreferrer">
                                Open provider
                              </a>
                            `
                          : ""}
                      </div>

                      <div class="detail-meta">
                        <div class="badge">${detail.provider}</div>
                        ${detail.state ? html`<div class="badge">${detail.state}</div>` : ""}
                        ${detail.author ? html`<div class="badge">${detail.author}</div>` : ""}
                        ${detail.sourceBranch
                          ? html`<div class="badge">${detail.sourceBranch}${detail.targetBranch ? ` → ${detail.targetBranch}` : ""}</div>`
                          : ""}
                        ${detail.updatedAt ? html`<div class="badge">${detail.updatedAt}</div>` : ""}
                      </div>
                    </div>

                    <div class="segmented">
                      ${(["overview", "diff", "commits"] as WorkspaceTab[]).map(
                        (tab) => html`
                          <button
                            type="button"
                            data-active=${String(this.workspaceTab === tab)}
                            @click=${() => {
                              this.workspaceTab = tab;
                            }}
                          >
                            ${tab}
                          </button>
                        `
                      )}
                    </div>

                    <div class="detail-body">
                      <div class="detail-scroll">
                        ${this.detailError
                          ? html`<div class="notice" data-tone="error">${this.detailError}</div>`
                          : this.loadingDetail
                            ? html`<div class="notice">Loading review detail…</div>`
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
                                  `}
                      </div>
                    </div>
                  `
                : html`<div class="notice">Choose a review request from the inbox to open the workspace.</div>`}
            </div>
          </section>

          <aside class="analysis">
            <div class="analysis-panel panel">
              <div class="section-head">
                <div>
                  <div class="eyebrow">AI review and publishing</div>
                  <h2>Action rail</h2>
                </div>
                ${detail ? html`<div class="badge" data-tone="accent">${detail.provider}</div>` : ""}
              </div>

              <div class="segmented">
                ${(["review", "summary", "chat", "comment"] as AnalysisTab[]).map(
                  (tab) => html`
                    <button
                      type="button"
                      data-active=${String(this.analysisTab === tab)}
                      @click=${async () => {
                        this.analysisTab = tab;
                        if (tab === "chat") {
                          await this.ensureChatContext();
                        }
                      }}
                    >
                      ${tab}
                    </button>
                  `
                )}
              </div>

              <div class="analysis-body">
                <div class="analysis-scroll">
                  ${!detail
                    ? html`<div class="notice">Open a request before running AI workflows or posting comments.</div>`
                    : this.analysisTab === "review"
                      ? this.renderReviewPanel()
                      : this.analysisTab === "summary"
                        ? this.renderSummaryPanel()
                        : this.analysisTab === "chat"
                          ? this.renderChatPanel()
                          : this.renderCommentPanel()}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    `;
  }

  private renderOverview(detail: ReviewTarget) {
    return html`
      <div class="overview-grid">
        <section class="card">
          <div class="eyebrow">Request summary</div>
          <p class="muted">
            ${detail.description || detail.summary || "This request has no rich description from the provider. Use the diff and commit tabs for the full review context."}
          </p>
        </section>

        <section class="card">
          <div class="eyebrow">Workspace stats</div>
          <div class="actions">
            <div class="badge">${this.diffFiles.length} changed files</div>
            <div class="badge">${this.commits.length} commits</div>
            <div class="badge">${this.reviewResult?.inlineComments.length ?? 0} AI inline notes</div>
          </div>
        </section>

        <section class="card">
          <div class="eyebrow">Workflow availability</div>
          <div class="stack">
            <div class="notice">Review and summarize are available for all configured providers.</div>
            <div class="notice" data-tone=${detail.provider === "reviewboard" ? "warning" : "success"}>
              ${detail.provider === "reviewboard"
                ? "Review Board can receive summary review posts, but inline comment workflows stay disabled in the web workspace."
                : "GitLab and GitHub support generated review posts plus manual inline comments from the diff viewer."}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private renderCommits() {
    if (this.commits.length === 0) {
      return html`<div class="notice">No commits are available for this review target.</div>`;
    }

    return html`
      <div class="commit-list">
        ${this.commits.map(
          (commit) => html`
            <article class="commit">
              <strong>${commit.title}</strong>
              <div class="muted">${commit.id}</div>
              <div class="subtle">${commit.author || "Unknown author"}${commit.createdAt ? ` • ${commit.createdAt}` : ""}</div>
            </article>
          `
        )}
      </div>
    `;
  }

  private renderReviewPanel() {
    return html`
      <section class="card">
        <div class="section-head">
          <div>
            <div class="eyebrow">Run review</div>
            <h3>Agent selection</h3>
          </div>
          <label class="badge">
            <input
              type="checkbox"
              .checked=${this.inlineCommentsEnabled}
              @change=${(event: Event) => {
                this.inlineCommentsEnabled = (event.target as HTMLInputElement).checked;
              }}
            />
            inline candidates
          </label>
        </div>

        <div class="agent-list">
          ${this.agentOptions.map(
            (option) => html`
              <div class="agent-card" data-active=${String(this.selectedAgents.includes(option.value))}>
                <label>
                  <span>
                    <input
                      type="checkbox"
                      .checked=${this.selectedAgents.includes(option.value)}
                      @change=${(event: Event) => this.toggleAgent(option.value, (event.target as HTMLInputElement).checked)}
                    />
                    ${option.title}
                  </span>
                  ${option.description ? html`<span class="muted">${option.description}</span>` : ""}
                </label>
              </div>
            `
          )}
        </div>

        <label>
          <div class="eyebrow">Regenerate with feedback</div>
          <textarea
            class="textarea"
            placeholder="Add a refinement instruction for the next review run"
            .value=${this.feedbackDraft}
            @input=${(event: Event) => {
              this.feedbackDraft = (event.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
        </label>

        <div class="actions">
          <button
            class="button"
            data-tone="primary"
            type="button"
            ?disabled=${this.runningReview || this.selectedAgents.length === 0}
            @click=${() => this.handleRunReview()}
          >
            ${this.runningReview ? "Running review…" : "Run review"}
          </button>
          <button
            class="button"
            type="button"
            ?disabled=${!this.reviewResult || this.postingGeneratedReview}
            @click=${() => this.handlePostGeneratedReview()}
          >
            ${this.postingGeneratedReview ? "Posting…" : "Post generated review"}
          </button>
        </div>
      </section>

      ${this.reviewWarnings.map(
        (warning) => html`<div class="notice" data-tone="warning">${warning}</div>`
      )}

      ${this.reviewResult
        ? html`
            <section class="card">
              <div class="eyebrow">Aggregated result</div>
              <p class="muted">${this.reviewResult.overallSummary || this.reviewResult.output}</p>
            </section>

            ${this.reviewResult.inlineComments.length > 0
              ? html`
                  <section class="card">
                    <div class="eyebrow">Inline candidates</div>
                    <div class="stack">
                      ${this.reviewResult.inlineComments.map(
                        (comment) => html`
                          <div class="inline-item">
                            <strong>${comment.filePath}:${comment.line}</strong>
                            <p class="muted">${comment.comment}</p>
                          </div>
                        `
                      )}
                    </div>
                  </section>
                `
              : ""}

            ${this.reviewResult.agentResults?.length
              ? html`
                  <section class="card">
                    <div class="eyebrow">Per-agent output</div>
                    <div class="outputs">
                      ${this.reviewResult.agentResults.map(
                        (agent) => html`
                          <article class="inline-item">
                            <strong>${agent.name}</strong>
                            <p class="muted">${agent.failed ? agent.error || "Agent failed." : agent.output}</p>
                          </article>
                        `
                      )}
                    </div>
                  </section>
                `
              : ""}
          `
        : ""}
    `;
  }

  private renderSummaryPanel() {
    return html`
      <section class="card">
        <div class="eyebrow">Generate summary</div>
        <div class="actions">
          <button
            class="button"
            data-tone="primary"
            type="button"
            ?disabled=${this.runningSummary}
            @click=${() => this.handleRunSummary()}
          >
            ${this.runningSummary ? "Generating…" : "Generate summary"}
          </button>
        </div>
      </section>

      ${this.summaryResult
        ? html`
            <section class="card">
              <div class="eyebrow">Summary output</div>
              <p class="muted">${this.summaryResult.output}</p>
            </section>
          `
        : ""}
    `;
  }

  private renderChatPanel() {
    return html`
      ${this.chatContext
        ? html`
            <section class="card">
              <div class="eyebrow">Chat context</div>
              <p class="muted">${this.chatContext.summary}</p>
            </section>
          `
        : html`
            <section class="card">
              <div class="eyebrow">Prepare context</div>
              <div class="actions">
                <button
                  class="button"
                  data-tone="primary"
                  type="button"
                  ?disabled=${this.loadingChat}
                  @click=${() => this.ensureChatContext()}
                >
                  ${this.loadingChat ? "Preparing…" : "Load chat context"}
                </button>
              </div>
            </section>
          `}

      ${this.chatHistory.length > 0
        ? html`
            <section class="chat-thread">
              ${this.chatHistory.flatMap((entry) => [
                html`<article class="chat-turn"><strong>You</strong><p>${entry.question}</p></article>`,
                html`<article class="chat-turn" data-role="assistant"><strong>CR</strong><p>${entry.answer}</p></article>`,
              ])}
            </section>
          `
        : ""}

      <section class="card">
        <div class="eyebrow">Ask a question</div>
        <textarea
          class="textarea"
          placeholder="Ask about risks, test gaps, branch intent, or suspicious changes"
          .value=${this.chatQuestion}
          @input=${(event: Event) => {
            this.chatQuestion = (event.target as HTMLTextAreaElement).value;
          }}
        ></textarea>
        <div class="actions">
          <button
            class="button"
            data-tone="primary"
            type="button"
            ?disabled=${this.loadingChat || !this.chatContext || !this.chatQuestion.trim()}
            @click=${() => this.handleAskQuestion()}
          >
            ${this.loadingChat ? "Thinking…" : "Ask"}
          </button>
        </div>
      </section>
    `;
  }

  private renderCommentPanel() {
    const reviewBoardInlineDisabled = this.selectedTarget?.provider === "reviewboard";

    return html`
      <section class="card">
        <div class="eyebrow">Summary comment</div>
        <textarea
          class="textarea"
          placeholder="Write a provider comment or paste/edit the generated review before posting"
          .value=${this.summaryDraft}
          @input=${(event: Event) => {
            this.summaryDraft = (event.target as HTMLTextAreaElement).value;
          }}
        ></textarea>
        <div class="actions">
          <button
            class="button"
            data-tone="primary"
            type="button"
            ?disabled=${this.postingSummary || !this.summaryDraft.trim()}
            @click=${() => this.handlePostSummaryComment()}
          >
            ${this.postingSummary ? "Posting…" : "Post summary comment"}
          </button>
          ${this.reviewResult
            ? html`
                <button
                  class="button"
                  type="button"
                  @click=${() => {
                    this.summaryDraft = this.reviewResult?.overallSummary || this.reviewResult?.output || "";
                  }}
                >
                  Copy generated text
                </button>
              `
            : ""}
        </div>
      </section>

      <section class="card">
        <div class="eyebrow">Inline comment composer</div>
        ${this.selectedLine
          ? html`
              <div class="notice">
                ${this.selectedLine.filePath}:${this.selectedLine.line} (${this.selectedLine.positionType})
                <div class="subtle mono">${this.selectedLine.text}</div>
              </div>
            `
          : html`<div class="notice">Choose a line in the diff view to anchor an inline comment.</div>`}

        ${reviewBoardInlineDisabled
          ? html`<div class="notice" data-tone="warning">Review Board inline comments are not enabled in this workspace yet. Use a summary review instead.</div>`
          : ""}

        <textarea
          class="textarea"
          placeholder="Write a precise inline note"
          .value=${this.inlineDraft}
          @input=${(event: Event) => {
            this.inlineDraft = (event.target as HTMLTextAreaElement).value;
          }}
        ></textarea>
        <div class="actions">
          <button
            class="button"
            data-tone="primary"
            type="button"
            ?disabled=${this.postingInline || reviewBoardInlineDisabled || !this.selectedLine || !this.inlineDraft.trim()}
            @click=${() => this.handlePostInlineComment()}
          >
            ${this.postingInline ? "Posting…" : "Post inline comment"}
          </button>
        </div>
      </section>
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
