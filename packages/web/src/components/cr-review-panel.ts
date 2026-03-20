import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Bot } from "lucide";
import type { ReviewAgentOption, ReviewWorkflowResult } from "../types.js";
import "./cr-icon.js";
import { renderCollapsibleCard } from "./render-collapsible-card.js";
import { renderMarkdown } from "./render-markdown.js";

const sectionEyebrowClass =
  "text-[0.72rem] font-semibold tracking-[0.08em] text-base-content/40";

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
    return html`
      <div class="flex flex-col gap-3 pb-2">
        ${!this.canRunWorkflows
          ? html`<div class="alert alert-warning text-xs">
              Review requires a connected repository source.
            </div>`
          : ""}
        ${!this.reviewResult
          ? html`<div class="alert alert-info text-xs">
              Run a review to generate an aggregated summary, inline
              comments, and per-agent detail.
            </div>`
          : ""}

        ${renderCollapsibleCard({
          cardClass: "bg-base-300 border border-base-100/10",
          summaryClass: "px-4 py-3.5",
          bodyClass: "cr-review-control-card__body",
          summary: html`
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="text-base font-semibold">Review Workflow</h3>
                <div class=${sectionEyebrowClass}>
                  Choose the agents below, then run the review when you are
                  ready
                </div>
              </div>
              <label class="cursor-pointer flex items-center gap-1.5 text-xs">
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
                Inline Comments
              </label>
            </div>
          `,
          body: html`
            <div class="cr-review-control-card__content">
              <div class="grid gap-2">
                ${this.agentOptions.map(
                  (option) => html`
                    <label
                      class="cursor-pointer flex items-start gap-2.5 rounded-[0.7rem] border px-3 py-3 transition-colors
                      ${this.selectedAgents.includes(option.value)
                        ? "border-primary/40 bg-primary/10"
                        : "border-base-100/10 bg-base-100/38 hover:border-base-content/20"}"
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
                          ? html`<span
                              class="text-xs text-base-content/50"
                              >${option.description}</span
                            >`
                          : ""}
                      </div>
                    </label>
                  `
                )}
              </div>
            </div>
            <div class="cr-review-control-card__footer">
              <div class="cr-review-control-card__footer-actions">
                <button
                  class="btn btn-primary btn-sm min-w-[8rem] gap-1.5"
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
                  ${this.runningReview ? "Running review…" : "Run review"}
                </button>
                <button
                  class="btn btn-ghost btn-sm min-w-[7rem] gap-1.5"
                  type="button"
                  ?disabled=${!this.reviewResult ||
                  this.postingGeneratedReview}
                  @click=${() => this.emit("post-generated-review")}
                >
                  ${this.postingGeneratedReview
                    ? html`<span
                        class="loading loading-spinner loading-xs"
                      ></span>`
                    : ""}
                  Post review
                </button>
              </div>
            </div>
          `,
        })}

        ${this.reviewWarnings.map(
          (w) => html`<div class="alert alert-warning text-xs">${w}</div>`
        )}
        ${this.reviewResult ? this.renderResult() : ""}
      </div>
    `;
  }

  private renderResult() {
    const result = this.reviewResult!;
    return html`
      <section
        class="rounded-[0.75rem] border border-base-300 bg-base-300 px-4 py-4"
      >
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 class="text-sm font-semibold">Aggregated Review</h3>
            <div class=${sectionEyebrowClass}>
              Review generated from one or more agents
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span class="badge badge-ghost badge-sm"
              >${result.selectedAgents.length} agents</span
            >
            <span class="badge badge-ghost badge-sm"
              >${result.inlineComments.length} inline comments</span
            >
          </div>
        </div>
        <div class="mt-3 text-sm text-base-content/80">
          ${renderMarkdown(result.overallSummary || result.output, {
            className: "text-sm text-base-content/80",
            emptyText: "No aggregate review output was generated.",
          })}
        </div>
      </section>

      ${result.inlineComments.length > 0
        ? html`
            <section
              class="rounded-[0.75rem] border border-base-300 bg-base-300 px-4 py-4"
            >
              <div
                class="flex items-center justify-between gap-2"
              >
                <div>
                  <h3 class="text-sm font-semibold">Inline Comments</h3>
                  <div class=${sectionEyebrowClass}>
                    Suggested inline comments
                  </div>
                </div>
                <span class="badge badge-ghost badge-sm"
                  >${result.inlineComments.length}</span
                >
              </div>
              <div class="mt-3 flex flex-col gap-2.5">
                ${result.inlineComments.map(
                  (c) => html`
                    <div
                      class="rounded-[0.7rem] border border-base-100/10 bg-base-100/42 px-3 py-3"
                    >
                      <div class="font-mono text-xs text-primary">
                        ${c.filePath}:${c.line}
                      </div>
                      <div class="mt-2 text-xs text-base-content/70">
                        ${renderMarkdown(c.comment, {
                          className: "text-xs text-base-content/70",
                          compact: true,
                          emptyText: "No inline note content.",
                        })}
                      </div>
                    </div>
                  `
                )}
              </div>
            </section>
          `
        : ""}
      ${result.agentResults?.length
        ? html`
            ${renderCollapsibleCard({
              cardClass: "bg-base-300 border border-base-100/10",
              summaryClass: "px-4 py-3.5",
              bodyClass: "flex flex-col gap-3",
              summary: html`
                <div
                  class="flex items-center justify-between gap-2"
                >
                  <div>
                    <h3 class="text-sm font-semibold">
                      Agent Perspectives
                    </h3>
                    <div class=${sectionEyebrowClass}>
                      Per-agent output
                    </div>
                  </div>
                  <span class="badge badge-ghost badge-sm"
                    >${result.agentResults!.length}</span
                  >
                </div>
              `,
              body: html`
                ${result.agentResults!.map(
                  (a) => html`
                    <article
                      class="rounded-[0.7rem] border border-base-100/10 bg-base-100/42 px-3 py-3"
                    >
                      <div
                        class="flex items-center justify-between gap-2"
                      >
                        <div class="font-semibold text-sm">
                          ${a.name}
                        </div>
                        ${a.failed
                          ? html`<span class="badge badge-error badge-xs"
                              >Failed</span
                            >`
                          : html`<span class="badge badge-ghost badge-xs"
                              >Ready</span
                            >`}
                      </div>
                      <div class="mt-2 text-xs text-base-content/70">
                        ${renderMarkdown(
                          a.failed
                            ? a.error || "Agent failed."
                            : a.output,
                          {
                            className: "text-xs text-base-content/70",
                            compact: true,
                            emptyText: "No agent output.",
                          }
                        )}
                      </div>
                    </article>
                  `
                )}
              `,
            })}
          `
        : ""}
    `;
  }
}
