import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CheckCircle2, ChevronRight, FolderSearch, Settings2, Sparkles } from "lucide";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import {
  providerLabels,
  providerOrder,
  type DashboardData,
  type ProviderId,
  type ProviderRepositoryOption,
} from "../types.js";
import "./cr-icon.js";
import "./cr-provider-icon.js";

@customElement("cr-overview-page")
export class CrOverviewPage extends LitElement {
  @property({ attribute: false }) dashboard: DashboardData | null = null;
  @property({ type: Number }) selectedAgentCount = 0;
  @property({ attribute: false }) selectedRepositories: Record<
    ProviderId,
    ProviderRepositoryOption | null
  > = {
    gitlab: null,
    github: null,
    reviewboard: null,
  };
  @property({ type: Boolean }) loading = false;
  @property() activeProvider: ProviderId = "gitlab";

  override createRenderRoot() {
    return this;
  }

  private goTo(section: string) {
    this.dispatchEvent(
      new CustomEvent("section-change", { detail: section, bubbles: true, composed: true })
    );
  }

  private renderProvider(provider: ProviderId) {
    const data = this.dashboard?.providers?.[provider];
    const repository = this.selectedRepositories[provider]?.label || data?.repository;
    const configured = data?.configured ?? false;
    const ready = configured && Boolean(repository);
    const detail = !configured
      ? data?.error || "Add credentials in Settings"
      : repository || "Select a repository to load requests";
    const status = !configured ? "Set up" : ready ? "Ready" : "Choose repository";
    const requests = data?.items.length ?? 0;

    return html`
      <button type="button" class="cr-overview-provider" @click=${() => this.goTo(provider)}>
        <span class="cr-overview-provider__icon"><cr-provider-icon .provider=${provider} .size=${17}></cr-provider-icon></span>
        <span class="cr-overview-provider__body">
          <span class="cr-overview-provider__title">${providerLabels[provider]}</span>
          <span class="cr-overview-provider__detail">${detail}</span>
        </span>
        <span class="cr-overview-provider__status">
          <span class="cr-status-dot ${ready ? "cr-status-dot--ready" : configured ? "cr-status-dot--pending" : "cr-status-dot--missing"}"></span>${status}
        </span>
        <span class="cr-overview-provider__requests">${ready ? `${requests} open` : ""}</span>
        <cr-icon .icon=${ChevronRight} .size=${16} class="cr-overview-provider__chevron"></cr-icon>
      </button>
    `;
  }

  private renderConfig(label: string, value: string, note: string, ready: boolean) {
    return html`
      <div class="cr-overview-config-row">
        <span class="cr-status-dot ${ready ? "cr-status-dot--ready" : "cr-status-dot--pending"}"></span>
        <div class="min-w-0">
          <div class="cr-overview-config-row__label">${label}</div>
          <div class="cr-overview-config-row__value" title=${value}>${value}</div>
          <div class="cr-overview-config-row__note">${note}</div>
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="cr-fade-in flex flex-col gap-7">
          <div><h1 class="cr-page-heading text-2xl font-bold">Overview</h1><p class="cr-page-subtitle text-sm mt-1">Loading review workspace…</p></div>
          <div class="cr-overview-layout"><div class="cr-skeleton h-96 rounded-lg"></div><div class="cr-skeleton h-64 rounded-lg"></div></div>
        </div>
      `;
    }

    const configured = providerOrder.filter(
      (provider) => this.dashboard?.providers?.[provider]?.configured
    ).length;
    const routed = providerOrder.filter((provider) =>
      Boolean(this.selectedRepositories[provider])
    ).length;
    const openRequests = providerOrder.reduce(
      (total, provider) => total + (this.dashboard?.providers?.[provider]?.items.length ?? 0),
      0
    );
    const agents = this.dashboard?.config?.defaultReviewAgents ?? [];
    const openai = this.dashboard?.config?.openai;
    const webhook = this.dashboard?.config?.webhook;
    const enabledWebhooks = providerOrder.filter(
      (provider) => webhook?.providers?.[provider]?.enabled
    ).length;
    const needsSetup = configured < providerOrder.length || routed < configured;
    const nextStep =
      configured < providerOrder.length
        ? "Finish provider setup"
        : routed < configured
          ? "Choose a repository"
          : "Open your review workspace";

    return html`
      <div class="cr-fade-in flex flex-col gap-7">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 class="cr-page-heading text-2xl font-bold">Overview</h1>
            <p class="cr-page-subtitle text-sm mt-1">What is ready to review, what needs attention, and where to go next.</p>
          </div>
          ${Button({ variant: "ghost", size: "sm", className: "gap-1.5", onClick: () => this.goTo("settings"), children: html`<cr-icon .icon=${Settings2} .size=${14}></cr-icon> Settings` })}
        </div>

        <div class="cr-overview-layout">
          <section class="cr-surface-card cr-overview-readiness rounded-lg border" aria-labelledby="review-readiness-title">
            <div class="cr-overview-readiness__header">
              <div><div class="cr-overview-kicker"><cr-icon .icon=${Sparkles} .size=${14}></cr-icon> Review readiness</div><h2 id="review-readiness-title" class="text-lg font-semibold mt-1">Your review workspace</h2></div>
              <div class="cr-overview-readiness__summary"><strong>${openRequests}</strong><span>open requests</span></div>
            </div>

            <div class="cr-overview-progress" aria-label="Workspace setup progress"><span class=${configured > 0 ? "is-complete" : ""}></span><span class=${routed > 0 ? "is-complete" : ""}></span><span class=${openRequests > 0 ? "is-complete" : ""}></span></div>
            <div class="cr-overview-progress-labels"><span>${configured}/${providerOrder.length} connected</span><span>${routed} routed</span><span>${openRequests} in queue</span></div>

            <div class="cr-overview-next-step">
              <div><span class="cr-overview-next-step__label">Suggested next step</span><strong>${nextStep}</strong></div>
              ${Button({ variant: "default", size: "sm", className: "gap-1.5", onClick: () => this.goTo(needsSetup ? "settings" : this.activeProvider), children: html`<cr-icon .icon=${FolderSearch} .size=${14}></cr-icon> Continue` })}
            </div>

            <div class="cr-overview-section-heading"><h3>Providers</h3><span>Select a provider to open its workspace</span></div>
            <div class="cr-overview-provider-list">${providerOrder.map((provider) => this.renderProvider(provider))}</div>
          </section>

          <aside class="cr-surface-card cr-overview-config rounded-lg border" aria-labelledby="workspace-config-title">
            <div class="cr-overview-config__header">
              <div><div class="cr-overview-kicker"><cr-icon .icon=${CheckCircle2} .size=${14}></cr-icon> Workspace</div><h2 id="workspace-config-title" class="text-base font-semibold mt-1">Configuration</h2></div>
              <button type="button" class="cr-overview-config__settings" @click=${() => this.goTo("settings")} aria-label="Open Settings" title="Open Settings"><cr-icon .icon=${Settings2} .size=${15}></cr-icon></button>
            </div>
            <div class="cr-overview-config__rows">
              ${this.renderConfig("AI runtime", openai?.model || "Not configured", openai?.configured ? openai.apiUrl || "Endpoint ready" : "Add an API endpoint", Boolean(openai?.configured))}
              ${this.renderConfig("Review agents", agents.join(", ") || `${this.selectedAgentCount || 1} default agent`, "Profiles used for each review run", agents.length > 0 || this.selectedAgentCount > 0)}
              ${this.renderConfig("Webhooks", `${enabledWebhooks}/${providerOrder.length} enabled`, `${webhook?.concurrency ?? 3} workers · queue ${webhook?.queueLimit ?? 50}`, enabledWebhooks > 0)}
            </div>
          </aside>
        </div>
      </div>
    `;
  }
}
