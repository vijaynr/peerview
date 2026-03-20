import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ArrowUpRight, GitBranch, ShieldCheck, Workflow, type IconNode } from "lucide";
import {
  providerLabels,
  type DashboardData,
  type ProviderId,
  type ProviderRepositoryOption,
} from "../types.js";
import "./cr-icon.js";

@customElement("cr-provider-summary-card")
export class CrProviderSummaryCard extends LitElement {
  @property() provider: ProviderId = "gitlab";
  @property({ attribute: false }) dashboard: DashboardData | null = null;
  @property({ attribute: false }) selectedRepository: ProviderRepositoryOption | null = null;

  override createRenderRoot() {
    return this;
  }

  private iconForProvider(provider: ProviderId): IconNode {
    switch (provider) {
      case "gitlab":
        return Workflow;
      case "github":
        return GitBranch;
      case "reviewboard":
        return ShieldCheck;
    }
  }

  private emitSectionChange() {
    this.dispatchEvent(
      new CustomEvent("section-change", {
        detail: this.provider,
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const data = this.dashboard?.providers?.[this.provider];
    const label = providerLabels[this.provider];
    const configured = data?.configured ?? false;
    const repoSelected = Boolean(this.selectedRepository);
    const repoLabel = this.selectedRepository?.label;

    let statusDotClass: string;
    let statusLabel: string;
    if (!configured) {
      statusDotClass = "cr-status-dot--missing";
      statusLabel = "Not configured";
    } else if (repoSelected) {
      statusDotClass = "cr-status-dot--ready";
      statusLabel = "Ready";
    } else {
      statusDotClass = "cr-status-dot--pending";
      statusLabel = "Needs repository";
    }

    return html`
      <div
        class="cr-overview-card"
        role="button"
        tabindex="0"
        @click=${this.emitSectionChange}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter") this.emitSectionChange();
        }}
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <cr-icon
              .icon=${this.iconForProvider(this.provider)}
              .size=${14}
              class="text-base-content/50 shrink-0"
            ></cr-icon>
            <span
              class="text-[0.7rem] font-semibold tracking-[0.06em] uppercase text-base-content/45"
              >${label}</span
            >
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="cr-status-dot ${statusDotClass}"></span>
            <span class="text-[0.65rem] font-medium text-base-content/40"
              >${statusLabel}</span
            >
          </div>
        </div>
        ${repoLabel
          ? html`<div
              class="text-sm font-semibold text-base-content/80 font-mono truncate"
            >
              ${repoLabel}
            </div>`
          : html`<div class="text-xs text-base-content/35">
              ${data?.error || "Select a repository to begin"}
            </div>`}
        <div
          class="flex items-center gap-1 mt-auto text-[0.7rem] text-primary/70 font-medium"
        >
          Open workspace
          <cr-icon .icon=${ArrowUpRight} .size=${11}></cr-icon>
        </div>
      </div>
    `;
  }
}
