import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./cr-icon.js";

type SelectedInlineTarget = {
  filePath: string;
  line: number;
  positionType: "new" | "old";
  text: string;
  key: string;
};

const sectionEyebrowClass =
  "text-[0.72rem] font-semibold tracking-[0.08em] text-base-content/40";

@customElement("cr-inline-comment-popover")
export class CrInlineCommentPopover extends LitElement {
  @property({ attribute: false }) selectedLine: SelectedInlineTarget | null =
    null;
  @property() inlineDraft = "";
  @property({ type: Boolean }) postingInline = false;
  @property({ type: Boolean }) isReviewBoard = false;

  override createRenderRoot() {
    return this;
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  render() {
    if (!this.selectedLine) return nothing;

    return html`
      <div
        class="cr-inline-comment-popover rounded-[0.75rem] border border-base-300 bg-base-200/98 p-4 backdrop-blur-md"
        style="box-shadow:var(--cr-shadow-3)"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-base-content/92">
              Inline comment
            </h3>
            <div class=${sectionEyebrowClass}>Comment on selected line</div>
          </div>
          <button
            class="btn btn-ghost btn-xs"
            type="button"
            @click=${() => this.emit("close-inline")}
          >
            Close
          </button>
        </div>

        <div
          class="mt-3 rounded-[0.7rem] border border-primary/20 bg-primary/8 px-3 py-3 text-xs"
        >
          <div class="font-mono text-primary">
            ${this.selectedLine.filePath}:${this.selectedLine.line}
            (${this.selectedLine.positionType})
          </div>
          <div class="mt-1 truncate font-mono text-base-content/55">
            ${this.selectedLine.text}
          </div>
        </div>

        ${this.isReviewBoard
          ? html`<div class="alert alert-warning mt-3 text-xs">
              Inline comments are not available for Review Board in this
              workspace.
            </div>`
          : ""}

        <div class="mt-3 flex flex-col gap-3">
          <textarea
            class="textarea textarea-bordered textarea-sm min-h-28 text-sm"
            rows="5"
            placeholder="Write a precise inline note"
            .value=${this.inlineDraft}
            @input=${(e: Event) => {
              this.emit(
                "inline-draft-change",
                (e.target as HTMLTextAreaElement).value
              );
            }}
          ></textarea>
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs text-base-content/50">
              Inline feedback posts directly to the provider thread for this
              line.
            </div>
            <button
              class="btn btn-primary btn-sm gap-1.5"
              type="button"
              ?disabled=${this.postingInline ||
              this.isReviewBoard ||
              !this.inlineDraft.trim()}
              @click=${() => this.emit("post-inline-comment")}
            >
              ${this.postingInline
                ? html`<span
                    class="loading loading-spinner loading-xs"
                  ></span>`
                : ""}
              Post inline
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
