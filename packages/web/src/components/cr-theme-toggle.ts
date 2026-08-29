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
    const nextLabel = isDark ? "Switch to light mode" : "Switch to dark mode";

    if (this.compact) {
      return html`
        <button
          type="button"
          class="cr-theme-switch cr-theme-switch--compact"
          data-theme=${this.theme}
          @click=${this.toggle}
          aria-label=${nextLabel}
          title=${nextLabel}
        >
          <cr-icon .icon=${isDark ? MoonStar : SunMedium} .size=${16}></cr-icon>
        </button>
      `;
    }

    return html`
      <button
        type="button"
        class="cr-theme-switch"
        data-theme=${this.theme}
        @click=${this.toggle}
        aria-label=${nextLabel}
        title=${nextLabel}
      >
        <span class="cr-theme-switch__thumb" aria-hidden="true"></span>
        <span class="cr-theme-switch__option"><cr-icon .icon=${SunMedium} .size=${14}></cr-icon><span>Light</span></span>
        <span class="cr-theme-switch__option"><cr-icon .icon=${MoonStar} .size=${14}></cr-icon><span>Dark</span></span>
      </button>
    `;
  }

  private toggle() {
    this.dispatchEvent(new CustomEvent("theme-toggle", { bubbles: true, composed: true }));
  }
}
