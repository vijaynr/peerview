import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ScrollText } from "lucide";
import type { ReviewWorkflowResult } from "../types.js";
import "./cr-icon.js";
import { renderCollapsibleCard } from "./render-collapsible-card.js";
import { renderMarkdown } from "./render-markdown.js";

const sectionEyebrowClass =
  "text-[0.72rem] font-semibold tracking-[0.08em] text-base-content/40";

@customElement("cr-summary-panel")
export class CrSummaryPanel extends LitElement {
  @property({ type: Boolean }) runningSummary = false;
  @property({ attribute: false }) summaryResult: ReviewWorkflowResult | null = null;
  @property({ type: Boolean }) canRunWorkflows = false;

  override createRenderRoot() {
    return this;
  }

  private emit(name: string) {
    this.dispatchEvent(
      new CustomEvent(name, { bubbles: true, composed: true })
    );
  }

  render() {
    return html`
      <div class="flex flex-col gap-3 pb-2">
        ${!this.canRunWorkflows
          ? html`<div class="alert alert-warning text-xs">
              Summary requires a connected repository source.
            </div>`
          : ""}
        ${!this.summaryResult
          ? html`<div class="alert alert-info text-xs">
              Generate a summary for a quick narrative overview of changes
              before a deeper review or discussion.
            </div>`
          : ""}

        ${renderCollapsibleCard({
          cardClass: "bg-base-300 border border-base-100/10",
          summaryClass: "px-4 py-3.5",
          bodyClass: "cr-review-control-card__body",
          summary: html`
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="text-base font-semibold">Summary Workflow</h3>
                <div class=${sectionEyebrowClass}>
                  Generate a narrative overview of changes
                </div>
              </div>
            </div>
          `,
          body: html`
            <div class="cr-review-control-card__footer">
              <div class="cr-review-control-card__footer-actions">
                <button
                  class="btn btn-primary btn-sm min-w-[10rem] gap-1.5"
                  type="button"
                  ?disabled=${!this.canRunWorkflows || this.runningSummary}
                  @click=${() => this.emit("run-summary")}
                >
                  ${this.runningSummary
                    ? html`<span
                        class="loading loading-spinner loading-xs"
                      ></span>`
                    : html`<cr-icon
                        .icon=${ScrollText}
                        .size=${14}
                      ></cr-icon>`}
                  ${this.runningSummary ? "Generating…" : "Generate summary"}
                </button>
              </div>
            </div>
          `,
        })}
        ${this.summaryResult
          ? html`
              <section
                class="rounded-[0.75rem] border border-base-300 bg-base-300 px-4 py-4"
              >
                <div class=${sectionEyebrowClass}>Summary output</div>
                <div class="mt-3 text-sm text-base-content/80">
                  ${renderMarkdown(this.summaryResult.output, {
                    className: "text-sm text-base-content/80",
                    emptyText: "No summary output was generated.",
                  })}
                </div>
              </section>
            `
          : ""}
      </div>
    `;
  }
}
