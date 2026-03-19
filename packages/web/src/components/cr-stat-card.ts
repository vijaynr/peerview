import { LitElement, html } from "lit";
import type { IconNode } from "lucide";
import "./cr-icon.js";

type StatTone = "default" | "accent" | "success";

export class CrStatCard extends LitElement {
  static properties = {
    eyebrow: {},
    value: {},
    note: {},
    tone: {},
    icon: { attribute: false },
  };

  override createRenderRoot() { return this; }

  declare eyebrow: string;
  declare value: string;
  declare note: string;
  declare tone: StatTone;
  declare icon: IconNode | null;

  constructor() {
    super();
    this.eyebrow = "";
    this.value = "";
    this.note = "";
    this.tone = "default";
    this.icon = null;
  }

  private get toneClass() {
    if (this.tone === "accent") return "border-primary/35";
    if (this.tone === "success") return "border-success/35";
    return "border-base-300";
  }

  render() {
    return html`
      <div class="h-full min-w-0 rounded-[0.55rem] border bg-base-200 px-4 py-4 flex flex-col gap-2 ${this.toneClass}">
        <div class="stat-title text-base-content/60">${this.eyebrow}</div>
        <div class="stat-value text-3xl font-bold tracking-tight flex items-center gap-2 min-w-0">
          ${this.icon ? html`<cr-icon .icon=${this.icon} .size=${22}></cr-icon>` : ""}
          ${this.value}
        </div>
        ${this.note
          ? html`<div class="stat-desc text-base-content/50">${this.note}</div>`
          : html`<div class="text-sm text-base-content/35">No additional detail.</div>`}
      </div>
    `;
  }
}

customElements.define("cr-stat-card", CrStatCard);
