import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { GitBranch } from "lucide";
import type { ReviewCommit } from "../types.js";
import "./cr-icon.js";

@customElement("cr-commits-list")
export class CrCommitsList extends LitElement {
  @property({ attribute: false }) commits: ReviewCommit[] = [];

  override createRenderRoot() {
    return this;
  }

  render() {
    if (this.commits.length === 0) {
      return html`
        <div class="cr-empty-state" style="min-height:10rem">
          <div class="cr-empty-state__icon">
            <cr-icon .icon=${GitBranch} .size=${24}></cr-icon>
          </div>
          <div class="cr-empty-state__title">No commits</div>
          <div class="cr-empty-state__description">
            No commits are available for this review target.
          </div>
        </div>
      `;
    }

    return html`
      <div class="flex flex-col gap-2">
        ${this.commits.map(
          (commit) => html`
            <div
              class="rounded-[0.55rem] border border-base-100/10 bg-base-300 px-4 py-3.5 flex flex-col gap-1"
            >
              <div class="font-semibold text-sm">${commit.title}</div>
              <div class="font-mono text-xs text-base-content/40">
                ${commit.id}
              </div>
              <div class="text-xs text-base-content/50">
                ${commit.author || "Unknown author"}${commit.createdAt
                  ? ` · ${commit.createdAt}`
                  : ""}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }
}
