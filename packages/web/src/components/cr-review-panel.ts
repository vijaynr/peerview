import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Bot, BotMessageSquare } from "lucide";
import type { ReviewAgentOption, ReviewWorkflowResult } from "../types.js";
import "./cr-icon.js";
import { renderMarkdown } from "./render-markdown.js";

@customElement("cr-review-panel")
export class CrReviewPanel extends LitElement {
  @property({ attribute: false }) agentOptions: ReviewAgentOption[] = [];
  @property({ attribute: false }) selectedAgents: string[] = [];
  @property({ type: Boolean }) inlineCommentsEnabled = true;
  @property() feedbackDraft = "";
  @property({ type: Boolean }) runningReview = false;
  @property({ type: Boolean }) postingGeneratedReview = false;
  @property({ attribute: false }) reviewResult: ReviewWorkflowResult | null = null;
  @property({ attribute: false }) reviewWarnings: string[] = [];
  @property({ type: Boolean }) canRunWorkflows = false;

  override createRenderRoot() {
    return this;
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  render() {
    const hasResult = !!this.reviewResult;
    return html`
      <div class="cr-review-panel">
        <div class="cr-review-scroll">
          ${!this.canRunWorkflows
            ? html`<div class="alert alert-warning text-xs">
                Review requires a connected repository source.
              </div>`
            : ""}

          <div class="cr-review-agents">
            <div class="cr-review-agents__header">
              <span class="cr-review-agents__title">Agents</span>
              <label class="cr-review-agents__toggle">
                <input
                  type="checkbox"
                  class="checkbox checkbox-xs"
                  .checked=${this.inlineCommentsEnabled}
                  @change=${(e: Event) => {
                    this.emit(
                      "inline-toggle",
                      (e.target as HTMLInputElement).checked
                    );
                  }}
                />
                Inline
              </label>
            </div>
            <div class="cr-review-agents__list">
              ${this.agentOptions.map(
                (option) => html`
                  <label
                    class="cr-review-agent-option ${this.selectedAgents.includes(option.value) ? "cr-review-agent-option--selected" : ""}"
                  >
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm mt-0.5"
                      .checked=${this.selectedAgents.includes(option.value)}
                      @change=${(e: Event) => {
                        this.emit("agent-toggle", {
                          value: option.value,
                          checked: (e.target as HTMLInputElement).checked,
                        });
                      }}
                    />
                    <div class="flex flex-col gap-0.5">
                      <span class="text-sm font-medium"
                        >${option.title}</span
                      >
                      ${option.description
                        ? html`<span class="text-xs text-base-content/50"
                            >${option.description}</span
                          >`
                        : ""}
                    </div>
                  </label>
                `
              )}
            </div>
          </div>

          ${this.reviewWarnings.map(
            (w) => html`<div class="alert alert-warning text-xs">${w}</div>`
          )}

          ${hasResult
            ? this.renderResult()
            : html`<p class="cr-review-hint">
                Run a review to generate aggregated results.
              </p>`}
        </div>

        <div class="cr-review-actions">
          <button
            class="btn btn-primary btn-sm flex-1 gap-1.5"
            type="button"
            ?disabled=${!this.canRunWorkflows ||
            this.runningReview ||
            this.selectedAgents.length === 0}
            @click=${() => this.emit("run-review")}
          >
            ${this.runningReview
              ? html`<span
                  class="loading loading-spinner loading-xs"
                ></span>`
              : html`<cr-icon .icon=${Bot} .size=${14}></cr-icon>`}
            ${this.runningReview ? "Running…" : "Run review"}
          </button>
          ${hasResult
            ? html`
                <button
                  class="btn btn-ghost btn-sm flex-1 gap-1.5"
                  type="button"
                  ?disabled=${this.postingGeneratedReview}
                  @click=${() => this.emit("post-generated-review")}
                >
                  ${this.postingGeneratedReview
                    ? html`<span
                        class="loading loading-spinner loading-xs"
                      ></span>`
                    : ""}
                  Post review
                </button>
              `
            : ""}
        </div>
      </div>
    `;
  }

  private renderResult() {
    if (!this.reviewResult) return html``;
    const result = this.reviewResult;
    return html`
      <div class="cr-review-info-banner">
        <span class="cr-review-info-banner__check">✓</span>
        Review generated
        <span class="cr-review-info-banner__sep">·</span>
        ${result.selectedAgents.length} agents
        <span class="cr-review-info-banner__sep">·</span>
        ${result.inlineComments.length} inline
      </div>

      <div class="cr-review-section">
        <div class="cr-review-section__label">Overall Review</div>
        <div class="cr-review-section__body">
          ${renderMarkdown(result.overallSummary || result.output, {
            className: "cr-markdown--muted",
            emptyText: "No aggregate review output was generated.",
          })}
        </div>
      </div>

      ${result.inlineComments.length > 0
        ? html`
            <div class="cr-review-section">
              <div class="cr-review-section__label">
                Inline Comments
                <span class="badge badge-ghost badge-xs ml-1.5"
                  >${result.inlineComments.length}</span
                >
              </div>
              <div class="cr-review-section__body">
                <div class="flex flex-col gap-2">
                  ${result.inlineComments.map(
                    (c) => html`
                      <div
                        class="rounded-lg border border-base-100/10 bg-base-100/42 px-3 py-2.5"
                      >
                        <div class="font-mono text-xs text-primary/80">
                          ${c.filePath}:${c.line}
                        </div>
                        <div class="mt-1.5">
                          ${renderMarkdown(c.comment, {
                            className: "cr-markdown--muted",
                            compact: true,
                            emptyText: "No inline note content.",
                          })}
                        </div>
                      </div>
                    `
                  )}
                </div>
              </div>
            </div>
          `
        : ""}

      ${result.agentResults?.map(
        (agent) => html`
          <div class="cr-review-section cr-review-section--agent">
            <div class="cr-review-section__label cr-review-section__label--agent">
              <span class="cr-review-section__agent-decor" aria-hidden="true"
                >//</span
              >
              <cr-icon .icon=${BotMessageSquare} .size=${13}></cr-icon>
              <span class="cr-review-section__agent-name">${agent.name}</span>
              ${agent.failed
                ? html`<span class="badge badge-error badge-xs ml-1.5"
                    >Failed</span
                  >`
                : ""}
            </div>
            <div class="cr-review-section__body">
              ${renderMarkdown(
                agent.failed ? agent.error || "Agent failed." : agent.output,
                {
                  className: "cr-markdown--muted",
                  compact: true,
                  emptyText: "No agent output.",
                }
              )}
            </div>
          </div>
        `
      )}
    `;
  }
}
