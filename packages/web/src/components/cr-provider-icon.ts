import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Diff, type IconNode } from "lucide";
import { siGithub, siGitlab } from "simple-icons";
import type { ProviderId } from "../types.js";
import "./cr-icon.js";

const brandIcon = (path: string): IconNode => [
  ["path", { d: path, fill: "currentColor", stroke: "none" }],
];

const gitlabIcon = brandIcon(siGitlab.path);
const githubIcon = brandIcon(siGithub.path);

@customElement("cr-provider-icon")
export class CrProviderIcon extends LitElement {
  @property() provider: ProviderId = "gitlab";
  @property({ type: Number }) size = 16;

  override createRenderRoot() {
    return this;
  }

  render() {
    if (this.provider === "gitlab") {
      return html`<cr-icon .icon=${gitlabIcon} .size=${this.size}></cr-icon>`;
    }

    if (this.provider === "github") {
      return html`<cr-icon .icon=${githubIcon} .size=${this.size}></cr-icon>`;
    }

    return html`<cr-icon .icon=${Diff} .size=${this.size}></cr-icon>`;
  }
}
