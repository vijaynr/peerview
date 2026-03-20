import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Bot, MessageSquare, ScrollText } from "lucide";
import type {
  ReviewDiscussionThread,
  ReviewTarget,
  ReviewWorkflowResult,
} from "../types.js";
import "./cr-icon.js";
import "./cr-discussion-thread.js";
import { renderMarkdown } from "./render-markdown.js";

@customElement("cr-comments-workspace")
export class CrCommentsWorkspace extends LitElement {
  @property({ attribute: false }) detail!: ReviewTarget;
  @property({ attribute: false }) reviewResult: ReviewWorkflowResult | null = null;
  @property({ attribute: false }) summaryResult: ReviewWorkflowResult | null = null;
  @property() summaryDraft = "";
  @property({ type: Boolean }) postingSummary = false;
  @property({ attribute: false }) discussions: ReviewDiscussionThread[] = [];
  @property({ type: Boolean }) loadingDiscussions = false;
  @property() discussionsError = "";
  @property() replyingToThreadId = "";
  @property() discussionReplyDraft = "";
  @property({ type: Boolean }) postingDiscussionReply = false;

  override createRenderRoot() {
    return this;
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  render() {
    if (this.detail.provider === "reviewboard") {
      return html`
        <div class="flex h-full items-center justify-center">
          <div class="cr-empty-state max-w-md">
            <div class="cr-empty-state__icon">
              <cr-icon .icon=${MessageSquare} .size=${28}></cr-icon>
            </div>
            <div class="cr-empty-state__title">
              Not available for Review Board
            </div>
            <div class="cr-empty-state__description">
              Discussion threading is not exposed in this workspace yet. Use
              the provider page to open the review request and post summary
              feedback.
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="cr-comments-workspace flex h-full min-h-0 flex-col gap-3">
        <!-- Composer -->
        <section class="cr-discussion-composer">
          <div class="cr-discussion-composer__header">
            <div class="cr-discussion-composer__assist">
              ${this.reviewResult
                ? html`
                    <button
                      class="btn btn-ghost btn-xs gap-1.5 rounded-[0.7rem]"
                      type="button"
                      @click=${() => {
                        this.emit(
                          "summary-draft-change",
                          this.reviewResult?.overallSummary ||
                            this.reviewResult?.output ||
                            ""
                        );
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
                        this.emit(
                          "summary-draft-change",
                          this.summaryResult?.output || ""
                        );
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
            @submit=${(event: Event) => {
              event.preventDefault();
              this.emit("post-summary-comment", this.summaryDraft.trim());
            }}
          >
            <textarea
              class="textarea textarea-bordered textarea-sm min-h-28 text-sm cr-discussion-composer__textarea"
              rows="5"
              placeholder="Write a comment"
              .value=${this.summaryDraft}
              @input=${(e: Event) => {
                this.emit(
                  "summary-draft-change",
                  (e.target as HTMLTextAreaElement).value
                );
              }}
            ></textarea>
            <div class="cr-discussion-composer__footer">
              <button
                class="btn btn-primary btn-sm gap-1.5"
                type="submit"
                ?disabled=${this.postingSummary ||
                !this.summaryDraft.trim()}
              >
                ${this.postingSummary
                  ? html`<span
                      class="loading loading-spinner loading-xs"
                    ></span>`
                  : ""}
                Post comment
              </button>
            </div>
          </form>
        </section>

        <!-- Discussion feed -->
        <section class="cr-discussion-feed">
          <div class="cr-discussion-feed__body">
            ${this.loadingDiscussions
              ? html`
                  <div class="cr-loader-shell">
                    <span
                      class="loading loading-spinner loading-sm text-primary"
                    ></span>
                    <span class="text-sm text-base-content/50"
                      >Loading discussions…</span
                    >
                  </div>
                `
              : this.discussionsError
                ? html`<div class="alert alert-warning text-sm">
                    ${this.discussionsError}
                  </div>`
                : this.discussions.length === 0
                  ? html`
                      <div class="cr-empty-state" style="min-height:10rem">
                        <div class="cr-empty-state__icon">
                          <cr-icon
                            .icon=${MessageSquare}
                            .size=${24}
                          ></cr-icon>
                        </div>
                        <div class="cr-empty-state__title">
                          No comments yet
                        </div>
                        <div class="cr-empty-state__description">
                          Start the conversation above or add an inline note
                          from the Diff tab.
                        </div>
                      </div>
                    `
                  : html`
                      <div class="flex flex-col gap-4">
                        ${this.discussions.map(
                          (thread) => html`
                            <cr-discussion-thread
                              .thread=${thread}
                              .replyingToThreadId=${this.replyingToThreadId}
                              .discussionReplyDraft=${this.discussionReplyDraft}
                              .postingReply=${this.postingDiscussionReply}
                            ></cr-discussion-thread>
                          `
                        )}
                      </div>
                    `}
          </div>
        </section>
      </div>
    `;
  }
}
