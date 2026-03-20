import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MessageSquare } from "lucide";
import type { ReviewChatContext, ReviewChatHistoryEntry } from "../types.js";
import "./cr-icon.js";
import { renderCollapsibleCard } from "./render-collapsible-card.js";
import { renderMarkdown } from "./render-markdown.js";

const sectionEyebrowClass =
  "text-[0.72rem] font-semibold tracking-[0.08em] text-base-content/40";

@customElement("cr-chat-panel")
export class CrChatPanel extends LitElement {
  @property({ attribute: false }) chatContext: ReviewChatContext | null = null;
  @property({ attribute: false }) chatHistory: ReviewChatHistoryEntry[] = [];
  @property() chatQuestion = "";
  @property({ type: Boolean }) loadingChat = false;
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
              Chat requires a connected repository source.
            </div>`
          : ""}
        ${!this.chatContext
          ? html`<div class="alert alert-info text-xs">
              Load chat context to ask questions about risks, missing tests,
              intent, or specific files.
            </div>`
          : ""}

        ${renderCollapsibleCard({
          cardClass: "bg-base-300 border border-base-100/10",
          summaryClass: "px-4 py-3.5",
          bodyClass: "cr-review-control-card__body",
          summary: html`
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="text-base font-semibold">Chat Workflow</h3>
                <div class=${sectionEyebrowClass}>
                  Ask questions about this review target
                </div>
              </div>
            </div>
          `,
          body: html`
            ${this.chatContext
              ? html`
                  <div class="px-4 pt-3 pb-1">
                    <div
                      class="rounded-[0.7rem] border border-base-100/10 bg-base-100/42 px-3 py-3 text-xs text-base-content/65"
                    >
                      ${renderMarkdown(this.chatContext.summary, {
                        className: "text-xs text-base-content/65",
                        compact: true,
                        emptyText: "Chat context summary is empty.",
                      })}
                    </div>
                  </div>
                `
              : ""}
            <div class="cr-review-control-card__footer">
              <div class="cr-review-control-card__footer-actions">
                <button
                  class="btn btn-primary btn-sm min-w-[10rem] gap-1.5"
                  type="button"
                  ?disabled=${!this.canRunWorkflows || this.loadingChat}
                  @click=${() => this.emit("load-chat-context")}
                >
                  ${this.loadingChat
                    ? html`<span
                        class="loading loading-spinner loading-xs"
                      ></span>`
                    : html`<cr-icon
                        .icon=${MessageSquare}
                        .size=${14}
                      ></cr-icon>`}
                  ${this.chatContext ? "Refresh context" : "Start conversation"}
                </button>
              </div>
            </div>
          `,
        })}
        ${this.chatContext ? this.renderConversation() : ""}
      </div>
    `;
  }

  private renderConversation() {
    return html`
      <section
        class="flex flex-col rounded-[0.75rem] border border-base-300 bg-base-300"
      >
        <div class="px-4 py-4">
          ${this.chatHistory.length > 0
            ? html`
                <div class="flex flex-col gap-3">
                  ${this.chatHistory.flatMap((entry) => [
                    html`
                      <div class="flex justify-end">
                        <div
                          class="max-w-[92%] rounded-[0.75rem] bg-primary px-3 py-3 text-sm text-primary-content shadow-sm"
                        >
                          ${entry.question}
                        </div>
                      </div>
                    `,
                    html`
                      <div class="flex justify-start">
                        <div
                          class="max-w-[96%] rounded-[0.75rem] border border-base-100/10 bg-base-100/48 px-3 py-3 text-sm text-base-content/82 shadow-sm"
                        >
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
            : ""}
        </div>

        <div class="border-t border-base-100/10 px-4 py-4">
          <textarea
            class="textarea textarea-bordered textarea-sm w-full min-h-24 text-sm"
            rows="4"
            placeholder="Ask about risk, intent, test gaps, branches, or a suspicious diff chunk"
            .value=${this.chatQuestion}
            @input=${(e: Event) => {
              this.emit(
                "question-change",
                (e.target as HTMLTextAreaElement).value
              );
            }}
            @keydown=${async (e: KeyboardEvent) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
                this.emit("ask-question");
            }}
          ></textarea>
          <div
            class="mt-3 flex items-center justify-between gap-3 flex-wrap"
          >
            <div class="text-xs text-base-content/50">
              Press Ctrl/Cmd+Enter to send faster.
            </div>
            <button
              class="btn btn-primary btn-sm gap-1.5"
              type="button"
              ?disabled=${!this.canRunWorkflows ||
              this.loadingChat ||
              !this.chatContext ||
              !this.chatQuestion.trim()}
              @click=${() => this.emit("ask-question")}
            >
              ${this.loadingChat
                ? html`<span
                    class="loading loading-spinner loading-xs"
                  ></span>`
                : html`<cr-icon
                    .icon=${MessageSquare}
                    .size=${14}
                  ></cr-icon>`}
              ${this.loadingChat ? "Thinking…" : "Ask"}
            </button>
          </div>
        </div>
      </section>
    `;
  }
}
