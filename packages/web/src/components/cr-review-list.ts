import { LitElement, css, html } from "lit";
import { dashboardThemeStyles } from "../styles.js";
import type { ProviderId, ReviewTarget } from "../types.js";

export class CrReviewList extends LitElement {
  static properties = {
    provider: {},
    targets: { attribute: false },
    selectedId: { type: Number },
    loading: { type: Boolean },
    error: {},
    configured: { type: Boolean },
  };

  static styles = [
    dashboardThemeStyles,
    css`
      :host {
        display: block;
      }

      .stack {
        display: grid;
        gap: 12px;
      }

      .card {
        display: grid;
        gap: 10px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.78);
        cursor: pointer;
        transition:
          transform 140ms ease,
          border-color 140ms ease,
          background 140ms ease;
      }

      .card:hover {
        transform: translateY(-1px);
        border-color: var(--line-strong);
        background: white;
      }

      .card[data-active="true"] {
        border-color: rgba(217, 118, 18, 0.24);
        background: rgba(255, 247, 237, 0.95);
      }

      .top,
      .meta {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }

      .meta {
        color: var(--ink-soft);
        font-size: 0.88rem;
      }

      h3 {
        font-size: 1rem;
        line-height: 1.28;
      }

      .empty {
        padding: 18px;
        border-radius: 16px;
        border: 1px dashed var(--line);
        color: var(--ink-soft);
        background: rgba(255, 255, 255, 0.55);
      }
    `,
  ];

  declare provider: ProviderId;
  declare targets: ReviewTarget[];
  declare selectedId: number;
  declare loading: boolean;
  declare error: string;
  declare configured: boolean;

  constructor() {
    super();
    this.provider = "gitlab";
    this.targets = [];
    this.selectedId = 0;
    this.loading = false;
    this.error = "";
    this.configured = true;
  }

  private emitSelect(target: ReviewTarget) {
    this.dispatchEvent(
      new CustomEvent("review-selected", {
        detail: target,
        bubbles: true,
        composed: true,
      })
    );
  }

  private toneForState(state: string | undefined) {
    if (!state) {
      return "default";
    }
    if (state.includes("open") || state.includes("pending")) {
      return "success";
    }
    if (state.includes("merge") || state.includes("submitted")) {
      return "accent";
    }
    return "danger";
  }

  render() {
    if (!this.configured) {
      return html`<div class="empty">This provider is not configured yet. Update CR config before loading its review queue.</div>`;
    }

    if (this.loading) {
      return html`<div class="empty">Loading review queue…</div>`;
    }

    if (this.error) {
      return html`<div class="empty">${this.error}</div>`;
    }

    if (this.targets.length === 0) {
      return html`<div class="empty">No review requests match the current filters.</div>`;
    }

    return html`
      <div class="stack">
        ${this.targets.map(
          (target) => html`
            <article
              class="card"
              data-active=${String(target.id === this.selectedId)}
              @click=${() => this.emitSelect(target)}
            >
              <div class="top">
                <div>
                  <div class="eyebrow">${this.provider}</div>
                  <h3>${this.requestPrefix(target)} ${target.title}</h3>
                </div>
                ${target.state
                  ? html`<div class="badge" data-tone=${this.toneForState(target.state)}>${target.state}</div>`
                  : ""}
              </div>

              <div class="meta">
                <span>${target.author || "Unknown author"}</span>
                ${target.updatedAt ? html`<span>${target.updatedAt}</span>` : ""}
              </div>

              <div class="meta">
                <span>${target.sourceBranch || "?"}${target.targetBranch ? html` → ${target.targetBranch}` : ""}</span>
                ${target.draft ? html`<span>Draft</span>` : ""}
              </div>
            </article>
          `
        )}
      </div>
    `;
  }

  private requestPrefix(target: ReviewTarget): string {
    return this.provider === "gitlab" ? `!${target.id}` : `#${target.id}`;
  }
}

customElements.define("cr-review-list", CrReviewList);
