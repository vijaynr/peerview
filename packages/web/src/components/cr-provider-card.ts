import { LitElement, html } from "lit";
import {
  providerLabels,
  type ProviderDashboard,
  type ProviderId,
} from "../types.js";
import "./cr-request-item.js";

export class CrProviderCard extends LitElement {
  static properties = {
    provider: {},
    data: { attribute: false },
  };

  override createRenderRoot() { return this; }

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
      <div class="h-full rounded-[0.55rem] border border-base-300 bg-base-200 px-4 py-4 flex flex-col gap-3 overflow-hidden">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-[0.72rem] font-semibold tracking-[0.08em] text-base-content/40 mb-1">${providerLabel}</div>
            ${repository ? html`<div class="text-xs text-base-content/50 font-mono mt-0.5 truncate">${repository}</div>` : ""}
          </div>
          <div class="badge ${configured ? "badge-success" : "badge-error"} badge-sm gap-1 shrink-0">
            ${configured ? "Configured" : "Missing config"}
          </div>
        </div>
        ${error ? html`<div class="alert alert-error text-xs py-2">${error}</div>` : ""}
        ${!error && items.length === 0 ? html`<div class="cr-empty-state"><p>No open review requests</p></div>` : ""}
        ${items.length > 0 ? html`
          <div class="flex flex-col gap-2">
            ${items.map(item => html`<cr-request-item .provider=${this.provider} .item=${item}></cr-request-item>`)}
          </div>
        ` : ""}
      </div>
    `;
  }
}

customElements.define("cr-provider-card", CrProviderCard);
