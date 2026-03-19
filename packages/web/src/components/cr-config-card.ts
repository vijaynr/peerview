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
      <div class="h-full rounded-[0.55rem] border border-base-300 bg-base-200 px-4 py-4 flex flex-col gap-2">
        <div class="text-[0.72rem] font-semibold tracking-[0.08em] text-base-content/40">${this.label}</div>
        <h3 class="text-lg font-bold">${this.value || "Not configured"}</h3>
        ${this.note
          ? html`<p class="text-sm text-base-content/50">${this.note}</p>`
          : html`<div class="text-sm text-base-content/35">No supporting detail configured.</div>`}
      </div>
    `;
  }
}

customElements.define("cr-config-card", CrConfigCard);
