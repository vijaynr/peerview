import { LitElement, html } from "lit";
import { FolderSearch } from "lucide";
import { providerLabels, type ProviderId, type ReviewTarget } from "../types.js";
import "./cr-icon.js";

export class CrReviewList extends LitElement {
  static properties = {
    provider: {},
    targets: { attribute: false },
    selectedId: { type: Number },
    loading: { type: Boolean },
    error: {},
    configured: { type: Boolean },
    emptyTitle: {},
    emptyDescription: {},
  };

  override createRenderRoot() { return this; }

  declare provider: ProviderId;
  declare targets: ReviewTarget[];
  declare selectedId: number;
  declare loading: boolean;
  declare error: string;
  declare configured: boolean;
  declare emptyTitle: string;
  declare emptyDescription: string;

  constructor() {
    super();
    this.provider = "gitlab";
    this.targets = [];
    this.selectedId = 0;
    this.loading = false;
    this.error = "";
    this.configured = true;
    this.emptyTitle = "";
    this.emptyDescription = "";
  }

  private emitSelect(target: ReviewTarget) {
    this.dispatchEvent(
      new CustomEvent("review-selected", {
        detail: target,
        bubbles: true,
        composed: true,
      })
    );
  }

  private stateBadgeClass(state: string | undefined) {
    if (!state) return "badge-ghost";
    if (state.includes("open") || state.includes("pending")) return "badge-success";
    if (state.includes("merge") || state.includes("submitted")) return "badge-primary";
    return "badge-error";
  }

  private formatLabel(value: string | undefined) {
    if (!value) {
      return "";
    }

    const normalized = value.replace(/[_-]+/g, " ").trim();
    if (!normalized) {
      return "";
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private requestLabel(plural = true) {
    if (this.provider === "gitlab") {
      return plural ? "merge requests" : "merge request";
    }

    if (this.provider === "github") {
      return plural ? "pull requests" : "pull request";
    }

    return plural ? "review requests" : "review request";
  }

  private renderStateShell(
    title: string,
    description: string,
    toneClass = "border-base-300/80 bg-base-300/35 text-base-content/55",
  ) {
    return html`
      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        <div
          class="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 rounded-[0.55rem] border border-dashed px-5 py-6 text-center ${toneClass}"
        >
          <cr-icon .icon=${FolderSearch} .size=${24}></cr-icon>
          <div class="text-sm font-semibold text-base-content/82">${title}</div>
          <div class="max-w-xs text-xs leading-5 text-base-content/55">${description}</div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.configured) {
      return this.renderStateShell(
        `${providerLabels[this.provider]} is not configured`,
        `Update CR settings before loading the ${this.requestLabel()} queue.`,
        "border-warning/35 bg-warning/10 text-warning-content",
      );
    }

    if (this.loading) {
      return html`
        <div class="min-h-0 flex-1 overflow-y-auto pr-1">
          <div class="flex h-full min-h-[16rem] items-center justify-center gap-2 rounded-[0.55rem] border border-base-300/80 bg-base-300/35 px-5 py-6 text-sm text-base-content/55">
            <span class="loading loading-spinner loading-sm"></span>
            Loading ${this.requestLabel()}…
          </div>
        </div>
      `;
    }

    if (this.error) {
      return this.renderStateShell(
        `Unable to load ${this.requestLabel()}`,
        this.error,
        "border-warning/35 bg-warning/10 text-warning-content",
      );
    }

    if (this.targets.length === 0) {
      if (this.emptyTitle || this.emptyDescription) {
        return this.renderStateShell(
          this.emptyTitle || `No ${this.requestLabel()} selected`,
          this.emptyDescription || `Select a ${providerLabels[this.provider]} repository to load this queue.`,
        );
      }

      return this.renderStateShell(
        `No ${this.requestLabel()} found`,
        `Try a different state filter or search query. The ${providerLabels[this.provider]} queue does not have any matching ${this.requestLabel()}.`,
      );
    }

    return html`
      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        <div class="flex flex-col gap-2">
        ${this.targets.map(
          (target) => html`
            <div
              class="rounded-lg bg-base-300/75 border cursor-pointer transition-all px-3 py-2.5
                ${target.id === this.selectedId
                  ? "border-primary/50 bg-primary/10"
                  : "border-base-100/10 hover:border-primary/40 hover:bg-base-200"}"
              @click=${() => this.emitSelect(target)}
            >
              <div class="flex flex-col gap-1.5">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-semibold text-sm leading-snug">
                    <span class="text-primary font-mono text-xs mr-1">${this.requestPrefix(target)}</span>
                    ${target.title}
                  </h3>
                  ${target.state
                    ? html`
                        <span class="badge badge-xs ${this.stateBadgeClass(target.state)} shrink-0">
                          ${this.formatLabel(target.state)}
                        </span>
                      `
                    : ""}
                </div>
                <div class="flex flex-wrap gap-2 text-xs text-base-content/50">
                  <span>${target.author || "Unknown author"}</span>
                  ${target.updatedAt ? html`<span>· ${target.updatedAt}</span>` : ""}
                  ${target.sourceBranch ? html`<span class="font-mono">${target.sourceBranch}${target.targetBranch ? ` → ${target.targetBranch}` : ""}</span>` : ""}
                  ${target.draft ? html`<span class="badge badge-ghost badge-xs">Draft</span>` : ""}
                </div>
              </div>
            </div>
          `
        )}
        </div>
      </div>
    `;
  }

  private requestPrefix(target: ReviewTarget): string {
    return this.provider === "gitlab" ? `!${target.id}` : `#${target.id}`;
  }
}

customElements.define("cr-review-list", CrReviewList);
