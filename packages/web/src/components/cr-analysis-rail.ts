import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Bot, ChevronLeft, ChevronRight } from "lucide";
import type {
  ProviderId,
  ProviderRepositoryOption,
  ReviewAgentOption,
  ReviewChatContext,
  ReviewChatHistoryEntry,
  ReviewTarget,
  ReviewWorkflowResult,
} from "../types.js";
import { providerLabels } from "../types.js";
import "./cr-icon.js";
import "./cr-review-panel.js";
import "./cr-summary-panel.js";
import "./cr-chat-panel.js";

type AnalysisTab = "review" | "summary" | "chat";

@customElement("cr-analysis-rail")
export class CrAnalysisRail extends LitElement {
  @property() provider: ProviderId = "gitlab";
  @property({ attribute: false }) detailTarget: ReviewTarget | null = null;
  @property() analysisTab: AnalysisTab = "review";
  @property({ type: Boolean }) collapsed = false;
  @property({ attribute: false }) selectedRepository: ProviderRepositoryOption | null = null;
  @property({ type: Boolean }) canRunWorkflows = false;

  // Review panel props
  @property({ attribute: false }) agentOptions: ReviewAgentOption[] = [];
  @property({ attribute: false }) selectedAgents: string[] = [];
  @property({ type: Boolean }) inlineCommentsEnabled = true;
  @property() feedbackDraft = "";
  @property({ type: Boolean }) runningReview = false;
  @property({ type: Boolean }) postingGeneratedReview = false;
  @property({ attribute: false }) reviewResult: ReviewWorkflowResult | null = null;
  @property({ attribute: false }) reviewWarnings: string[] = [];

  // Summary panel props
  @property({ type: Boolean }) runningSummary = false;
  @property({ attribute: false }) summaryResult: ReviewWorkflowResult | null = null;

  // Chat panel props
  @property({ attribute: false }) chatContext: ReviewChatContext | null = null;
  @property({ attribute: false }) chatHistory: ReviewChatHistoryEntry[] = [];
  @property() chatQuestion = "";
  @property({ type: Boolean }) loadingChat = false;

  override createRenderRoot() {
    return this;
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  private formatLabel(value: string) {
    const n = value.replace(/[_-]+/g, " ").trim();
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
  }

  render() {
    const label = providerLabels[this.provider];
    const detail = this.detailTarget;

    return html`
      <section
        class="cr-side-rail cr-side-rail--right rounded-[0.55rem] border border-base-300 bg-base-200 ${this.collapsed ? "cr-side-rail--collapsed" : ""}"
      >
        <button
          class="cr-side-rail__toggle cr-side-rail__toggle--right btn btn-ghost btn-sm"
          type="button"
          @click=${() => this.emit("toggle-analysis-rail")}
          aria-label=${this.collapsed ? "Expand AI action rail" : "Collapse AI action rail"}
          aria-expanded=${String(!this.collapsed)}
          title=${this.collapsed ? "Expand AI action rail" : "Collapse AI action rail"}
        >
          <cr-icon .icon=${this.collapsed ? ChevronLeft : ChevronRight} .size=${16}></cr-icon>
        </button>

        <div class="cr-side-rail__inner flex h-full min-h-0 flex-col gap-3 p-4">
          <div class="flex items-center justify-between gap-2">
            <div><h2 class="text-base font-semibold">Actions</h2></div>
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
                  @click=${() => this.emit("analysis-tab-change", tab)}
                >
                  ${this.formatLabel(tab)}
                </button>
              `
            )}
          </div>

          <div class="cr-side-rail__content">
            ${!detail
              ? html`
                  <div class="cr-empty-state" style="min-height:10rem">
                    <div class="cr-empty-state__icon"><cr-icon .icon=${Bot} .size=${24}></cr-icon></div>
                    <div class="cr-empty-state__title">AI Actions</div>
                    <div class="cr-empty-state__description">
                      ${this.selectedRepository
                        ? "Open a review request to run AI workflows."
                        : `Choose a ${label} repository, then open a review request.`}
                    </div>
                  </div>
                `
              : this.analysisTab === "review"
                ? html`
                    <cr-review-panel
                      .agentOptions=${this.agentOptions}
                      .selectedAgents=${this.selectedAgents}
                      .inlineCommentsEnabled=${this.inlineCommentsEnabled}
                      .feedbackDraft=${this.feedbackDraft}
                      .runningReview=${this.runningReview}
                      .postingGeneratedReview=${this.postingGeneratedReview}
                      .reviewResult=${this.reviewResult}
                      .reviewWarnings=${this.reviewWarnings}
                      .canRunWorkflows=${this.canRunWorkflows}
                    ></cr-review-panel>
                  `
                : this.analysisTab === "summary"
                  ? html`
                      <cr-summary-panel
                        .runningSummary=${this.runningSummary}
                        .summaryResult=${this.summaryResult}
                        .canRunWorkflows=${this.canRunWorkflows}
                      ></cr-summary-panel>
                    `
                  : html`
                      <cr-chat-panel
                        .chatContext=${this.chatContext}
                        .chatHistory=${this.chatHistory}
                        .chatQuestion=${this.chatQuestion}
                        .loadingChat=${this.loadingChat}
                        .canRunWorkflows=${this.canRunWorkflows}
                      ></cr-chat-panel>
                    `}
          </div>
        </div>
      </section>
    `;
  }
}
