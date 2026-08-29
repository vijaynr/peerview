import { Badge } from "@mariozechner/mini-lit/dist/Badge.js";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { LitElement, html } from "lit";
import { GitBranch, RefreshCw } from "lucide";
import "./cr-icon.js";

export class CrDashboardHeader extends LitElement {
  static properties = {
    generatedAt: {},
    loading: { type: Boolean },
    repositoryLabel: {},
    repositoryPath: {},
    remoteUrl: {},
  };

  override createRenderRoot() {
    return this;
  }

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
      <div class="cr-surface-card rounded-lg border p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">Review Ops</h1>
            <div class="flex flex-wrap gap-2 mt-1.5">
              ${this.repositoryLabel ? Badge({ variant: "secondary", className: "gap-1 font-mono", children: html`<cr-icon .icon=${GitBranch} .size=${12}></cr-icon> ${this.repositoryLabel}` }) : ""}
              ${this.generatedAt ? Badge({ variant: "secondary", children: this.generatedAt }) : ""}
              ${this.remoteUrl ? Badge({ variant: "outline", className: "border-[var(--cr-success)]/30 text-[var(--cr-success)]", children: "● remote detected" }) : ""}
            </div>
          </div>
          ${Button({
            variant: "ghost",
            size: "sm",
            className: "gap-1.5",
            disabled: this.loading,
            loading: this.loading,
            onClick: () => this.handleRefresh(),
            children: this.loading
              ? "Refreshing…"
              : html`<cr-icon .icon=${RefreshCw} .size=${14}></cr-icon> Refresh`,
          })}
        </div>
      </div>
    `;
  }
}

customElements.define("cr-dashboard-header", CrDashboardHeader);
