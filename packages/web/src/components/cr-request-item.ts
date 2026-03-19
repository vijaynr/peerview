import { LitElement, html } from "lit";
import type { DashboardRequest, ProviderId } from "../types.js";

function getRequestPrefix(provider: ProviderId, id: DashboardRequest["id"]): string {
  return provider === "gitlab" ? `!${id}` : `#${id}`;
}

function formatLabel(value: string | undefined) {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export class CrRequestItem extends LitElement {
  static properties = {
    provider: {},
    item: { attribute: false },
  };

  override createRenderRoot() { return this; }

  declare provider: ProviderId;
  declare item: DashboardRequest;

  constructor() {
    super();
    this.provider = "gitlab";
    this.item = {
      id: "",
      title: "",
      url: "#",
    };
  }

  render() {
    return html`
      <a href=${this.item.url} target="_blank" rel="noreferrer" class="block no-underline">
        <div class="rounded-lg bg-base-300/75 hover:bg-base-200 border border-base-100/10 hover:border-primary/30 transition-all cursor-pointer px-3 py-2.5">
          <div class="flex flex-col gap-2">
            <div class="font-semibold text-sm leading-snug">
              <span class="text-primary font-mono text-xs mr-1">${getRequestPrefix(this.provider, this.item.id)}</span>
              ${this.item.title}
            </div>
            <div class="flex flex-wrap gap-2 text-xs text-base-content/50">
              ${this.item.state
                ? html`
                    <span class="badge badge-ghost badge-xs">
                      ${formatLabel(this.item.state)}${this.item.draft ? " · Draft" : ""}
                    </span>
                  `
                : ""}
              ${this.item.author ? html`<span>${this.item.author}</span>` : ""}
              ${this.item.sourceBranch ? html`<span class="font-mono">${this.item.sourceBranch}${this.item.targetBranch ? ` → ${this.item.targetBranch}` : ""}</span>` : ""}
              ${this.item.updatedAt ? html`<span>${this.item.updatedAt}</span>` : ""}
            </div>
          </div>
        </div>
      </a>
    `;
  }
}

customElements.define("cr-request-item", CrRequestItem);
