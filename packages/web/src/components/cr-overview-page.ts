import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Bot, FolderSearch, Settings2, ShieldCheck } from "lucide";
import {
  providerOrder,
  type DashboardData,
  type ProviderId,
  type ProviderRepositoryOption,
} from "../types.js";
import "./cr-icon.js";
import "./cr-stat-card.js";
import "./cr-config-card.js";
import "./cr-provider-summary-card.js";

@customElement("cr-overview-page")
export class CrOverviewPage extends LitElement {
  @property({ attribute: false }) dashboard: DashboardData | null = null;
  @property({ type: Number }) selectedAgentCount = 0;
  @property({ attribute: false }) selectedRepositories: Record<
    ProviderId,
    ProviderRepositoryOption | null
  > = { gitlab: null, github: null, reviewboard: null };
  @property({ type: Boolean }) loading = false;
  @property() activeProvider: ProviderId = "gitlab";

  override createRenderRoot() {
    return this;
  }

  private emitSectionChange(section: string) {
    this.dispatchEvent(
      new CustomEvent("section-change", {
        detail: section,
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (this.loading) {
      return html`
        <div class="cr-fade-in flex flex-col gap-7">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">Overview</h1>
            <p class="text-base-content/50 text-sm mt-1">
              Loading dashboard…
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${[1, 2, 3].map(
              () =>
                html`<div
                  class="cr-skeleton h-28 rounded-[0.55rem]"
                ></div>`
            )}
          </div>
          <div
            class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            ${[1, 2, 3].map(
              () =>
                html`<div
                  class="cr-skeleton h-40 rounded-[0.55rem]"
                ></div>`
            )}
          </div>
        </div>
      `;
    }

    const configuredProviders = providerOrder.filter(
      (p) => this.dashboard?.providers?.[p]?.configured
    ).length;
    const defaultAgents =
      this.dashboard?.config?.defaultReviewAgents.length ??
      this.selectedAgentCount ??
      0;
    const activeRouting = providerOrder.filter(
      (p) => Boolean(this.selectedRepositories[p])
    ).length;

    const webhook = this.dashboard?.config?.webhook;
    const openai = this.dashboard?.config?.openai;
    const enabledWebhookProviders = providerOrder.filter(
      (provider) => this.dashboard?.config?.webhook?.providers?.[provider]?.enabled
    ).length;

    return html`
      <div class="cr-fade-in flex flex-col gap-7">
        <!-- Page header -->
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">Overview</h1>
            <p class="text-base-content/45 text-sm mt-1">
              Provider readiness, workspace routing, and configuration at a
              glance.
            </p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button
              class="btn btn-primary btn-sm gap-1.5"
              type="button"
              @click=${() => this.emitSectionChange(this.activeProvider)}
            >
              <cr-icon .icon=${FolderSearch} .size=${14}></cr-icon>
              Open workspace
            </button>
            <button
              class="btn btn-ghost btn-sm gap-1.5"
              type="button"
              @click=${() => this.emitSectionChange("settings")}
            >
              <cr-icon .icon=${Settings2} .size=${14}></cr-icon>
              Settings
            </button>
          </div>
        </div>

        <!-- Stats row -->
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch"
        >
          <div class="cr-card-enter">
            <cr-stat-card
              .eyebrow=${"Providers"}
              .value=${`${configuredProviders} of ${providerOrder.length}`}
              .note=${"Configured and available for review"}
              .tone=${configuredProviders === providerOrder.length
                ? "success"
                : "accent"}
              .icon=${ShieldCheck}
            ></cr-stat-card>
          </div>
          <div class="cr-card-enter">
            <cr-stat-card
              .eyebrow=${"Routing"}
              .value=${`${String(activeRouting)} active`}
              .note=${"Repositories selected for workspace"}
              .tone=${activeRouting > 0 ? "accent" : "default"}
              .icon=${FolderSearch}
            ></cr-stat-card>
          </div>
          <div class="cr-card-enter">
            <cr-stat-card
              .eyebrow=${"Agents"}
              .value=${String(defaultAgents || 1) +
              " profile" +
              ((defaultAgents || 1) !== 1 ? "s" : "")}
              .note=${"Review agents enabled for new runs"}
              .icon=${Bot}
            ></cr-stat-card>
          </div>
        </div>

        <!-- Provider summary cards -->
        <div
          class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          ${providerOrder.map(
            (provider, i) => html`
              <div
                class="cr-card-enter"
                style="animation-delay:${180 + i * 60}ms"
              >
                <cr-provider-summary-card
                  .provider=${provider}
                  .dashboard=${this.dashboard}
                  .selectedRepository=${this.selectedRepositories[provider]}
                ></cr-provider-summary-card>
              </div>
            `
          )}
        </div>

        <!-- Config overview -->
        <div
          class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          <div class="cr-card-enter" style="animation-delay:360ms">
            <cr-config-card
              .label=${"AI runtime"}
              .value=${openai?.model || "Not configured"}
              .note=${openai?.configured
                ? openai?.apiUrl || "Endpoint ready"
                : "Add endpoint in Settings"}
            ></cr-config-card>
          </div>
          <div class="cr-card-enter" style="animation-delay:420ms">
            <cr-config-card
              .label=${"Review agents"}
              .value=${this.dashboard?.config?.defaultReviewAgents.join(
                ", "
              ) || "General"}
              .note=${"Profiles for new workflow runs"}
            ></cr-config-card>
          </div>
          <div class="cr-card-enter" style="animation-delay:480ms">
            <cr-config-card
              .label=${"Webhook"}
              .value=${`${enabledWebhookProviders}/${providerOrder.length} live · ${webhook?.concurrency ?? 3} workers`}
              .note=${`${webhook?.queueLimit ?? 50} queue · ${webhook?.jobTimeoutMs ?? 600000}ms timeout${webhook?.sslEnabled ? " · SSL" : ""}`}
            ></cr-config-card>
          </div>
        </div>
      </div>
    `;
  }
}
