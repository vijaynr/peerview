import { LitElement, css, html } from "lit";
import { dashboardThemeStyles } from "../styles.js";

export class CrDashboardHeader extends LitElement {
  static properties = {
    generatedAt: {},
    loading: { type: Boolean },
    repositoryLabel: {},
    repositoryPath: {},
    remoteUrl: {},
  };

  static styles = [
    dashboardThemeStyles,
    css`
      :host {
        display: block;
      }

      header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 20px;
        padding: 24px 28px;
        border-radius: 24px;
        background:
          linear-gradient(135deg, rgba(255, 249, 242, 0.94), rgba(247, 240, 228, 0.9)),
          var(--panel);
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
      }

      .title {
        display: grid;
        gap: 10px;
      }

      h1 {
        font-size: clamp(2.1rem, 5vw, 3.9rem);
        line-height: 0.95;
        text-wrap: balance;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .actions {
        display: grid;
        justify-items: end;
        gap: 10px;
      }

      .repo {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      @media (max-width: 920px) {
        header {
          grid-template-columns: 1fr;
        }

        .actions {
          justify-items: start;
        }
      }
    `,
  ];

  declare generatedAt: string;
  declare loading: boolean;
  declare repositoryLabel: string;
  declare repositoryPath: string;
  declare remoteUrl: string;

  constructor() {
    super();
    this.generatedAt = "";
    this.loading = false;
    this.repositoryLabel = "";
    this.repositoryPath = "";
    this.remoteUrl = "";
  }

  private handleRefresh() {
    this.dispatchEvent(new CustomEvent("refresh", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <header>
        <div class="title">
          <div class="eyebrow">CR review command center</div>
          <h1>Provider inboxes, focused workflows, and configuration in one calm workspace.</h1>
          <div class="meta">
            ${this.repositoryLabel ? html`<div class="badge">${this.repositoryLabel}</div>` : ""}
            ${this.repositoryPath ? html`<div class="badge repo">${this.repositoryPath}</div>` : ""}
            ${this.remoteUrl ? html`<div class="badge">remote detected</div>` : ""}
          </div>
        </div>

        <div class="actions">
          <button class="button" data-tone="primary" type="button" ?disabled=${this.loading} @click=${this.handleRefresh}>
            ${this.loading ? "Refreshing…" : "Refresh queue"}
          </button>
          ${this.generatedAt ? html`<p class="muted">Updated ${this.generatedAt}</p>` : ""}
        </div>
      </header>
    `;
  }
}

customElements.define("cr-dashboard-header", CrDashboardHeader);
