import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ArrowUpRight } from "lucide";
import {
  providerLabels,
  type DashboardData,
  type ProviderId,
  type ProviderRepositoryOption,
} from "../types.js";
import "./cr-icon.js";
import "./cr-provider-icon.js";

@customElement("cr-provider-summary-card")
export class CrProviderSummaryCard extends LitElement {
  @property() provider: ProviderId = "gitlab";
  @property({ attribute: false }) dashboard: DashboardData | null = null;
  @property({ attribute: false }) selectedRepository: ProviderRepositoryOption | null = null;

  override createRenderRoot() {
    return this;
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
        class="cr-surface-card rounded-lg border p-4 flex flex-col gap-2.5"
        data-interactive="true"
        role="button"
        tabindex="0"
        @click=${this.emitSectionChange}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter") this.emitSectionChange();
        }}
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-foreground/60 shrink-0">
              <cr-provider-icon
                .provider=${this.provider}
                .size=${14}
              ></cr-provider-icon>
            </span>
            <span
              class="text-xs font-medium text-muted-foreground"
              >${label}</span
            >
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="cr-status-dot ${statusDotClass}"></span>
            <span class="text-xs font-medium text-muted-foreground"
              >${statusLabel}</span
            >
          </div>
        </div>
        ${
          repoLabel
            ? html`<div
              class="text-sm font-semibold text-foreground/80 font-mono truncate"
            >
              ${repoLabel}
            </div>`
            : html`<div class="text-xs text-foreground/35">
              ${data?.error || "Select a repository to begin"}
            </div>`
        }
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
