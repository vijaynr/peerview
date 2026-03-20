import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Settings2 } from "lucide";
import {
  providerLabels,
  type DashboardData,
  type ProviderId,
  type ProviderRepositoryOption,
  type ReviewAgentOption,
  type ReviewChatContext,
  type ReviewChatHistoryEntry,
  type ReviewCommit,
  type ReviewDiffFile,
  type ReviewDiscussionThread,
  type ReviewState,
  type ReviewTarget,
  type ReviewWorkflowResult,
} from "../types.js";
import "./cr-icon.js";
import "./cr-provider-repository-picker.js";
import "./cr-queue-rail.js";
import "./cr-workspace-panel.js";
import "./cr-analysis-rail.js";

type SelectedInlineTarget = {
  filePath: string;
  line: number;
  positionType: "new" | "old";
  text: string;
  key: string;
};

type WorkspaceTab = "overview" | "diff" | "commits" | "comments";
type AnalysisTab = "review" | "summary" | "chat";

@customElement("cr-provider-page")
export class CrProviderPage extends LitElement {
  @property() provider: ProviderId = "gitlab";
  @property({ type: Boolean }) configured = true;
  @property({ attribute: false }) dashboard: DashboardData | null = null;
  @property({ attribute: false }) targets: ReviewTarget[] = [];
  @property({ attribute: false }) selectedTarget: ReviewTarget | null = null;
  @property({ attribute: false }) detailTarget: ReviewTarget | null = null;
  @property({ attribute: false }) diffFiles: ReviewDiffFile[] = [];
  @property({ attribute: false }) commits: ReviewCommit[] = [];
  @property() selectedFileId = "";
  @property() selectedFilePatch = "";
  @property({ attribute: false }) selectedLine: SelectedInlineTarget | null = null;
  @property() stateFilter: ReviewState = "opened";

  // Workspace UI state
  @property() workspaceTab: WorkspaceTab = "diff";
  @property() analysisTab: AnalysisTab = "review";
  @property({ type: Boolean }) queueRailCollapsed = false;
  @property({ type: Boolean }) analysisRailCollapsed = false;
  @property() searchTerm = "";

  // Drafts
  @property() feedbackDraft = "";
  @property() summaryDraft = "";
  @property() inlineDraft = "";
  @property() chatQuestion = "";
  @property() replyingToThreadId = "";
  @property() discussionReplyDraft = "";

  // Agents
  @property({ attribute: false }) agentOptions: ReviewAgentOption[] = [];
  @property({ attribute: false }) selectedAgents: string[] = [];
  @property({ type: Boolean }) inlineCommentsEnabled = true;

  // AI results
  @property({ attribute: false }) reviewResult: ReviewWorkflowResult | null = null;
  @property({ attribute: false }) summaryResult: ReviewWorkflowResult | null = null;
  @property({ attribute: false }) chatContext: ReviewChatContext | null = null;
  @property({ attribute: false }) chatHistory: ReviewChatHistoryEntry[] = [];

  // Discussions
  @property({ attribute: false }) discussions: ReviewDiscussionThread[] = [];
  @property({ type: Boolean }) loadingDiscussions = false;
  @property() discussionsError = "";

  // Loading states
  @property({ type: Boolean }) loadingTargets = false;
  @property({ type: Boolean }) loadingDetail = false;
  @property({ type: Boolean }) loadingDiffPatch = false;
  @property({ type: Boolean }) loadingChat = false;
  @property({ type: Boolean }) runningReview = false;
  @property({ type: Boolean }) runningSummary = false;
  @property({ type: Boolean }) postingGeneratedReview = false;
  @property({ type: Boolean }) postingSummary = false;
  @property({ type: Boolean }) postingInline = false;
  @property({ type: Boolean }) postingDiscussionReply = false;

  // Errors
  @property() targetsError = "";
  @property() detailError = "";
  @property({ attribute: false }) reviewWarnings: string[] = [];

  // Repository
  @property({ attribute: false }) providerRepositoryOptions: ProviderRepositoryOption[] = [];
  @property({ attribute: false }) selectedRepository: ProviderRepositoryOption | null = null;
  @property({ type: Boolean }) providerRepositoryLoading = false;
  @property() providerRepositoryError = "";
  @property({ type: Boolean }) canRunRepositoryWorkflows = false;

  override createRenderRoot() {
    return this;
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  render() {
    const label = providerLabels[this.provider];

    if (!this.configured) {
      return html`
        <div class="cr-fade-in flex flex-1 items-center justify-center py-16">
          <div class="cr-empty-state cr-empty-state--warning max-w-md">
            <div class="cr-empty-state__icon">
              <cr-icon .icon=${Settings2} .size=${32}></cr-icon>
            </div>
            <div class="cr-empty-state__title">${label} is not configured</div>
            <div class="cr-empty-state__description">
              Add your ${label} connection details in Settings before loading
              this provider's review queue.
            </div>
            <button
              class="btn btn-primary btn-sm gap-1.5 mt-3"
              type="button"
              @click=${() => this.emit("section-change", "settings")}
            >
              <cr-icon .icon=${Settings2} .size=${16}></cr-icon>
              Open Settings
            </button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="cr-fade-in cr-provider-page flex h-full min-h-0 flex-col gap-5">
        ${this.renderRepositorySelectionCard(label)}

        <div
          class="cr-provider-workspace"
          style=${`--cr-left-rail:${this.queueRailCollapsed ? "4rem" : "22rem"}; --cr-right-rail:${this.analysisRailCollapsed ? "4rem" : "24rem"};`}
        >
          <cr-queue-rail
            .provider=${this.provider}
            .targets=${this.targets}
            .selectedTarget=${this.selectedTarget}
            .stateFilter=${this.stateFilter}
            .searchTerm=${this.searchTerm}
            .loadingTargets=${this.loadingTargets}
            .targetsError=${this.targetsError}
            .configured=${this.configured}
            .selectedRepository=${this.selectedRepository}
            .collapsed=${this.queueRailCollapsed}
            @toggle-queue-rail=${() => { this.queueRailCollapsed = !this.queueRailCollapsed; }}
            @search-change=${(e: CustomEvent) => { this.searchTerm = e.detail; }}
          ></cr-queue-rail>

          <cr-workspace-panel
            .provider=${this.provider}
            .detailTarget=${this.detailTarget}
            .diffFiles=${this.diffFiles}
            .commits=${this.commits}
            .selectedFileId=${this.selectedFileId}
            .selectedFilePatch=${this.selectedFilePatch}
            .selectedLine=${this.selectedLine}
            .workspaceTab=${this.workspaceTab}
            .loadingDetail=${this.loadingDetail}
            .loadingDiffPatch=${this.loadingDiffPatch}
            .detailError=${this.detailError}
            .selectedRepository=${this.selectedRepository}
            .discussions=${this.discussions}
            .loadingDiscussions=${this.loadingDiscussions}
            .discussionsError=${this.discussionsError}
            .replyingToThreadId=${this.replyingToThreadId}
            .discussionReplyDraft=${this.discussionReplyDraft}
            .postingDiscussionReply=${this.postingDiscussionReply}
            .summaryDraft=${this.summaryDraft}
            .postingSummary=${this.postingSummary}
            .reviewResult=${this.reviewResult}
            .summaryResult=${this.summaryResult}
            .inlineDraft=${this.inlineDraft}
            .postingInline=${this.postingInline}
            @workspace-tab-change=${(e: CustomEvent) => {
              this.workspaceTab = e.detail;
              if (e.detail !== "diff") this.selectedLine = null;
            }}
            @summary-draft-change=${(e: CustomEvent) => { this.summaryDraft = e.detail; }}
            @inline-draft-change=${(e: CustomEvent) => { this.inlineDraft = e.detail; }}
            @reply-draft-change=${(e: CustomEvent) => { this.discussionReplyDraft = e.detail; }}
            @close-inline=${() => { this.selectedLine = null; this.inlineDraft = ""; }}
            @line-selected=${(e: CustomEvent) => { this.selectedLine = e.detail; }}
          ></cr-workspace-panel>

          <cr-analysis-rail
            .provider=${this.provider}
            .detailTarget=${this.detailTarget}
            .analysisTab=${this.analysisTab}
            .collapsed=${this.analysisRailCollapsed}
            .selectedRepository=${this.selectedRepository}
            .canRunWorkflows=${this.canRunRepositoryWorkflows}
            .agentOptions=${this.agentOptions}
            .selectedAgents=${this.selectedAgents}
            .inlineCommentsEnabled=${this.inlineCommentsEnabled}
            .feedbackDraft=${this.feedbackDraft}
            .runningReview=${this.runningReview}
            .postingGeneratedReview=${this.postingGeneratedReview}
            .reviewResult=${this.reviewResult}
            .reviewWarnings=${this.reviewWarnings}
            .runningSummary=${this.runningSummary}
            .summaryResult=${this.summaryResult}
            .chatContext=${this.chatContext}
            .chatHistory=${this.chatHistory}
            .chatQuestion=${this.chatQuestion}
            .loadingChat=${this.loadingChat}
            @toggle-analysis-rail=${() => { this.analysisRailCollapsed = !this.analysisRailCollapsed; }}
            @analysis-tab-change=${(e: CustomEvent) => { this.analysisTab = e.detail; }}
            @agent-toggle=${(e: CustomEvent) => {
              const { value, checked } = e.detail;
              const next = new Set(this.selectedAgents);
              if (checked) next.add(value);
              else if (next.size > 1) next.delete(value);
              this.selectedAgents = Array.from(next);
            }}
            @inline-toggle=${(e: CustomEvent) => { this.inlineCommentsEnabled = e.detail; }}
            @question-change=${(e: CustomEvent) => { this.chatQuestion = e.detail; }}
          ></cr-analysis-rail>
        </div>
      </div>
    `;
  }

  private renderRepositorySelectionCard(label: string) {
    return html`
      <section class="rounded-[0.55rem] border border-base-300 bg-base-200/80 px-4 py-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="min-w-0 flex items-center gap-3">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <cr-icon .icon=${Settings2} .size=${14} class="text-primary"></cr-icon>
            </div>
            <div>
              <h2 class="text-sm font-semibold">${label} Repository</h2>
              <div class="text-[0.72rem] text-base-content/40">Select a project to load its review queue</div>
            </div>
          </div>

          <div class="min-w-[18rem] flex-1 max-w-xl">
            <cr-provider-repository-picker
              .provider=${this.provider}
              .options=${this.providerRepositoryOptions}
              .selectedId=${this.selectedRepository?.id || ""}
              .loading=${this.providerRepositoryLoading}
              .error=${this.providerRepositoryError}
              @provider-repository-selected=${(e: CustomEvent) => this.emit("repository-selected", e.detail)}
              @provider-repository-refresh=${() => this.emit("repository-refresh")}
            ></cr-provider-repository-picker>
          </div>

          ${this.selectedRepository
            ? html`
                <button
                  type="button"
                  class="btn btn-ghost btn-sm rounded-[0.55rem] text-base-content/60 hover:text-base-content"
                  @click=${() => this.emit("repository-clear")}
                >
                  Clear
                </button>
              `
            : ""}
        </div>
      </section>
    `;
  }
}
