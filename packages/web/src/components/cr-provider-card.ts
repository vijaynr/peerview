import { LitElement, html } from "lit";
import { Alert } from "@mariozechner/mini-lit/dist/Alert.js";
import { providerLabels, type ProviderDashboard, type ProviderId } from "../types.js";
import "./cr-request-item.js";

export class CrProviderCard extends LitElement {
  static properties = {
    provider: {},
    data: { attribute: false },
  };

  override createRenderRoot() {
    return this;
  }

  declare provider: ProviderId;
  declare data: ProviderDashboard | null;

  constructor() {
    super();
    this.provider = "gitlab";
    this.data = null;
  }

  render() {
    if (!this.data) {
      return html``;
    }

    const { configured, repository, error, items } = this.data;
    const providerLabel = providerLabels[this.provider];

    return html`
      <div class="cr-surface-card rounded-lg border p-4 flex flex-col gap-2.5">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[0.7rem] font-semibold tracking-[0.06em] uppercase text-foreground/45">${providerLabel}</span>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="cr-status-dot ${configured ? "cr-status-dot--ready" : "cr-status-dot--missing"}"></span>
            <span class="text-[0.65rem] font-medium text-foreground/40">${configured ? "Configured" : "Missing"}</span>
          </div>
        </div>
        ${repository ? html`<div class="text-xs text-foreground/55 font-mono truncate">${repository}</div>` : ""}
        ${error ? Alert({ variant: "destructive", className: "bg-destructive/10 text-xs py-2", children: error }) : ""}
        ${!error && items.length === 0 ? html`<div class="cr-empty-state"><p>No open review requests</p></div>` : ""}
        ${
          items.length > 0
            ? html`
          <div class="flex flex-col gap-2">
            ${items.map((item) => html`<cr-request-item .provider=${this.provider} .item=${item}></cr-request-item>`)}
          </div>
        `
            : ""
        }
      </div>
    `;
  }
}

customElements.define("cr-provider-card", CrProviderCard);
