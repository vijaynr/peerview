import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MoonStar, SunMedium } from "lucide";
import type { UITheme } from "../types.js";
import "./cr-icon.js";

@customElement("cr-theme-toggle")
export class CrThemeToggle extends LitElement {
  @property() theme: UITheme = "dark";
  @property({ type: Boolean }) compact = false;

  override createRenderRoot() {
    return this;
  }

  render() {
    const isDark = this.theme === "dark";
    return html`
      <button
        type="button"
        class="btn ${this.compact ? "btn-ghost btn-sm btn-square" : "btn-ghost btn-sm justify-start gap-2 rounded-[0.8rem] border border-base-100/10 bg-base-100/50"}"
        @click=${this.toggle}
        aria-label=${isDark ? "Switch to light theme" : "Switch to dark theme"}
        title=${isDark ? "Switch to light theme" : "Switch to dark theme"}
      >
        <cr-icon .icon=${isDark ? SunMedium : MoonStar} .size=${this.compact ? 16 : 15}></cr-icon>
        ${this.compact ? "" : html`<span>${isDark ? "Light theme" : "Dark theme"}</span>`}
      </button>
    `;
  }

  private toggle() {
    this.dispatchEvent(
      new CustomEvent("theme-toggle", { bubbles: true, composed: true })
    );
  }
}
