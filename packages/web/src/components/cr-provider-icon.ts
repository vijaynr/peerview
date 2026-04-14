import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Diff, Github, Gitlab } from "lucide";
import type { ProviderId } from "../types.js";
import "./cr-icon.js";

@customElement("cr-provider-icon")
export class CrProviderIcon extends LitElement {
  @property() provider: ProviderId = "gitlab";
  @property({ type: Number }) size = 16;

  override createRenderRoot() {
    return this;
  }

  render() {
    if (this.provider === "gitlab") {
      return html`<cr-icon .icon=${Gitlab} .size=${this.size}></cr-icon>`;
    }

    if (this.provider === "github") {
      return html`<cr-icon .icon=${Github} .size=${this.size}></cr-icon>`;
    }

    return html`<cr-icon .icon=${Diff} .size=${this.size}></cr-icon>`;
  }
}
