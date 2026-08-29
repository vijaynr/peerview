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

  override createRenderRoot() {
    return this;
  }

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
    if (this.tone === "accent") return "border-primary/30 hover:border-primary/45";
    if (this.tone === "success") return "border-green-600/30 hover:border-green-600/45";
    return "";
  }

  render() {
    return html`
      <div class="cr-surface-card rounded-lg border p-4 flex flex-col gap-2.5 ${this.toneClass}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-medium text-muted-foreground">${this.eyebrow}</span>
          ${this.icon ? html`<cr-icon .icon=${this.icon} .size=${15} class="text-muted-foreground/50"></cr-icon>` : ""}
        </div>
        <div class="text-2xl font-bold tracking-tight text-foreground truncate">${this.value}</div>
        ${
          this.note
            ? html`<div class="text-xs text-muted-foreground leading-relaxed">${this.note}</div>`
            : ""
        }
      </div>
    `;
  }
}

customElements.define("cr-stat-card", CrStatCard);
