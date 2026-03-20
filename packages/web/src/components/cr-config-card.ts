import { LitElement, html } from "lit";

export class CrConfigCard extends LitElement {
  static properties = {
    label: {},
    value: {},
    note: {},
  };

  override createRenderRoot() { return this; }

  declare label: string;
  declare value: string;
  declare note: string;

  constructor() {
    super();
    this.label = "";
    this.value = "";
    this.note = "";
  }

  render() {
    return html`
      <div class="cr-overview-card">
        <span class="text-[0.7rem] font-semibold tracking-[0.06em] uppercase text-base-content/45">${this.label}</span>
        <div class="text-sm font-semibold text-base-content/80 break-words">${this.value || "Not configured"}</div>
        ${this.note
          ? html`<div class="text-xs text-base-content/45 leading-relaxed">${this.note}</div>`
          : ""}
      </div>
    `;
  }
}

customElements.define("cr-config-card", CrConfigCard);
