import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ArrowUpRight, Reply, X } from "lucide";
import type { ReviewDiscussionMessage, ReviewDiscussionThread } from "../types.js";
import { renderMarkdown } from "./render-markdown.js";
import "./cr-icon.js";

@customElement("cr-discussion-thread")
export class CrDiscussionThread extends LitElement {
  @property({ attribute: false }) thread!: ReviewDiscussionThread;
  @property() replyingToThreadId = "";
  @property() discussionReplyDraft = "";
  @property({ type: Boolean }) postingReply = false;

  override createRenderRoot() {
    return this;
  }

  private get isReplying() {
    return this.replyingToThreadId === this.thread.id;
  }

  private discussionLocationLabel(
    inline?: ReviewDiscussionMessage["inline"]
  ) {
    if (!inline?.filePath) return "";
    const start = inline.line ? `:${inline.line}` : "";
    const end =
      inline.endLine && inline.endLine !== inline.line
        ? `-${inline.endLine}`
        : "";
    return `${inline.filePath}${start}${end}`;
  }

  private threadTimestamp() {
    const msgs = this.thread.messages;
    const latest = msgs[msgs.length - 1];
    return (
      latest?.updatedAt ||
      latest?.createdAt ||
      msgs[0]?.createdAt ||
      ""
    );
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  private formatRelativeTime(value: string) {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      return value;
    }

    const diffMs = timestamp - Date.now();
    const absMs = Math.abs(diffMs);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;
    const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    if (absMs < minute) {
      return "just now";
    }
    if (absMs < hour) {
      return formatter.format(Math.round(diffMs / minute), "minute");
    }
    if (absMs < day) {
      return formatter.format(Math.round(diffMs / hour), "hour");
    }
    if (absMs < week) {
      return formatter.format(Math.round(diffMs / day), "day");
    }
    if (absMs < month) {
      return formatter.format(Math.round(diffMs / week), "week");
    }
    if (absMs < year) {
      return formatter.format(Math.round(diffMs / month), "month");
    }

    return formatter.format(Math.round(diffMs / year), "year");
  }

  render() {
    const thread = this.thread;
    const replying = this.isReplying;
    const starter = thread.messages[0]?.author || "Reviewer";
    const lastUpdated = this.threadTimestamp();
    const location = this.discussionLocationLabel(
      thread.messages.find((m) => m.inline)?.inline
    );
    const relativeUpdated = lastUpdated
      ? `Updated ${this.formatRelativeTime(lastUpdated)}`
      : "";
    const metaItems = [
      { label: starter, kind: "default" },
      relativeUpdated ? { label: relativeUpdated, kind: "default" } : null,
      location ? { label: location, kind: "location" } : null,
      thread.resolved ? { label: "Resolved", kind: "default" } : null,
    ].filter((item): item is { label: string; kind: "default" | "location" } => item !== null);

    return html`
      <section class="cr-discussion-thread">
        <div class="cr-discussion-thread__header">
          <div class="min-w-0">
            <div class="cr-discussion-thread__meta">
              ${metaItems.map((item, index) => html`
                <span
                  class=${item.kind === "location"
                    ? "cr-discussion-thread__meta-item cr-discussion-thread__location"
                    : "cr-discussion-thread__meta-item"}
                  data-first=${index === 0 ? "true" : "false"}
                >
                  ${item.label}
                </span>
              `)}
            </div>
          </div>
          <div class="cr-discussion-thread__actions">
            ${thread.messages[0]?.url
              ? html`
                  <a
                    class="cr-discussion-thread__action cr-discussion-thread__action--secondary"
                    href=${thread.messages[0].url}
                    target="_blank"
                    rel="noreferrer"
                    ><cr-icon .icon=${ArrowUpRight} .size=${12}></cr-icon>Open</a
                  >
                `
              : ""}
            ${thread.replyable
              ? html`
                  <button
                    class="cr-discussion-thread__action ${replying
                      ? "cr-discussion-thread__action--primary"
                      : "cr-discussion-thread__action--secondary"}"
                    type="button"
                    @click=${() => {
                      if (replying) {
                        this.emit("cancel-reply");
                      } else {
                        this.emit("start-reply", thread);
                      }
                    }}
                  >
                    <cr-icon .icon=${replying ? X : Reply} .size=${12}></cr-icon>
                    ${replying ? "Close reply" : "Reply"}
                  </button>
                `
              : ""}
          </div>
        </div>

        <div class="cr-discussion-thread__messages">
          ${thread.messages.map((msg, i) =>
            this.renderMessage(thread, msg, i)
          )}
        </div>

        ${replying ? this.renderReplyForm(thread) : nothing}
      </section>
    `;
  }

  private renderMessage(
    thread: ReviewDiscussionThread,
    message: ReviewDiscussionMessage,
    index: number
  ) {
    const author = message.author || "Reviewer";
    const timestamp = message.updatedAt || message.createdAt || "";
    const showInlineLocation =
      Boolean(message.inline) && thread.kind !== "inline";
    const inlineLocation = this.discussionLocationLabel(message.inline);

    return html`
      <article
        class="cr-discussion-message ${index === 0
          ? "cr-discussion-message--root"
          : ""}"
      >
        ${index > 0
          ? html`
              <div class="cr-discussion-message__meta">
                <div class="cr-discussion-message__author-line">
                  <span class="cr-discussion-message__author"
                    >${author}</span
                  >
                  ${timestamp ? html`<span>${timestamp}</span>` : ""}
                  ${showInlineLocation && inlineLocation
                    ? html`<span class="cr-discussion-thread__location"
                        >${inlineLocation}</span
                      >`
                    : ""}
                </div>
                ${message.url
                  ? html`
                      <a
                        class="cr-discussion-message__link"
                        href=${message.url}
                        target="_blank"
                        rel="noreferrer"
                        >Open</a
                      >
                    `
                  : ""}
              </div>
            `
          : ""}
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

  private renderReplyForm(thread: ReviewDiscussionThread) {
    return html`
      <form
        class="cr-discussion-reply"
        @submit=${async (event: Event) => {
          event.preventDefault();
          this.emit("post-discussion-reply", {
            threadId: thread.id,
            replyTargetId: thread.replyTargetId,
            body: this.discussionReplyDraft.trim(),
          });
        }}
      >
        <textarea
          class="textarea textarea-bordered textarea-sm min-h-24 text-sm w-full"
          rows="4"
          placeholder="Write a reply"
          .value=${this.discussionReplyDraft}
          @input=${(e: Event) => {
            this.emit(
              "reply-draft-change",
              (e.target as HTMLTextAreaElement).value
            );
          }}
        ></textarea>
        <div class="cr-discussion-reply__footer">
          <button
            class="btn btn-ghost btn-sm"
            type="button"
            @click=${() => this.emit("cancel-reply")}
          >
            Cancel
          </button>
          <button
            class="btn btn-primary btn-sm gap-1.5"
            type="submit"
            ?disabled=${this.postingReply ||
            !this.discussionReplyDraft.trim()}
          >
            ${this.postingReply
              ? html`<span
                  class="loading loading-spinner loading-xs"
                ></span>`
              : ""}
            Post reply
          </button>
        </div>
      </form>
    `;
  }
}
