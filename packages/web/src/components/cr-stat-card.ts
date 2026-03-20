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
    if (this.tone === "accent") return "cr-overview-card--accent";
    if (this.tone === "success") return "cr-overview-card--success";
    return "";
  }

  render() {
    return html`
      <div class="cr-overview-card ${this.toneClass}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[0.7rem] font-semibold tracking-[0.06em] uppercase text-base-content/45">${this.eyebrow}</span>
          ${this.icon ? html`<cr-icon .icon=${this.icon} .size=${15} class="text-base-content/25"></cr-icon>` : ""}
        </div>
        <div class="text-2xl font-bold tracking-tight text-base-content/90 truncate">${this.value}</div>
        ${this.note
          ? html`<div class="text-xs text-base-content/45 leading-relaxed">${this.note}</div>`
          : ""}
      </div>
    `;
  }
}

customElements.define("cr-stat-card", CrStatCard);
