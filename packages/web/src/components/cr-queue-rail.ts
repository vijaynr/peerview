import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChevronLeft, ChevronRight, Search } from "lucide";
import {
  providerLabels,
  providerQueueLabels,
  reviewStates,
  type ProviderId,
  type ProviderRepositoryOption,
  type ReviewState,
  type ReviewTarget,
} from "../types.js";
import "./cr-icon.js";
import "./cr-review-list.js";

@customElement("cr-queue-rail")
export class CrQueueRail extends LitElement {
  @property() provider: ProviderId = "gitlab";
  @property({ attribute: false }) targets: ReviewTarget[] = [];
  @property({ attribute: false }) selectedTarget: ReviewTarget | null = null;
  @property() stateFilter: ReviewState = "opened";
  @property() searchTerm = "";
  @property({ type: Boolean }) loadingTargets = false;
  @property() targetsError = "";
  @property({ type: Boolean }) configured = true;
  @property({ attribute: false }) selectedRepository: ProviderRepositoryOption | null = null;
  @property({ type: Boolean }) collapsed = false;

  override createRenderRoot() {
    return this;
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  private get filteredTargets() {
    const search = this.searchTerm.trim().toLowerCase();
    if (!search) return this.targets;
    return this.targets.filter((t) =>
      [t.title, t.author, t.sourceBranch, t.targetBranch, t.repository, String(t.id)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  private formatLabel(value: string) {
    const normalized = value.replace(/[_-]+/g, " ").trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
  }

  private queueCountLabel(count: number) {
    if (this.provider === "gitlab") return `${count} merge request${count === 1 ? "" : "s"}`;
    if (this.provider === "github") return `${count} pull request${count === 1 ? "" : "s"}`;
    return `${count} review request${count === 1 ? "" : "s"}`;
  }

  render() {
    const filtered = this.filteredTargets;

    return html`
      <section
        class="cr-side-rail cr-side-rail--left rounded-[0.55rem] border border-base-300 bg-base-200 ${this.collapsed ? "cr-side-rail--collapsed" : ""}"
      >
        <button
          class="cr-side-rail__toggle cr-side-rail__toggle--left btn btn-ghost btn-sm"
          type="button"
          @click=${() => this.emit("toggle-queue-rail")}
          aria-label=${this.collapsed ? `Expand ${providerQueueLabels[this.provider]}` : `Collapse ${providerQueueLabels[this.provider]}`}
          aria-expanded=${String(!this.collapsed)}
          title=${this.collapsed ? `Expand ${providerQueueLabels[this.provider]}` : `Collapse ${providerQueueLabels[this.provider]}`}
        >
          <cr-icon .icon=${this.collapsed ? ChevronRight : ChevronLeft} .size=${16}></cr-icon>
        </button>

        <div class="cr-side-rail__inner flex h-full min-h-0 flex-col gap-3 p-4">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <h2 class="text-base font-semibold">${providerQueueLabels[this.provider]}</h2>
            </div>
            <div class="badge badge-primary badge-sm">${this.formatLabel(this.stateFilter)}</div>
          </div>

          <div class="tabs tabs-boxed cr-tab-strip cr-tab-strip--full">
            ${reviewStates.map(
              (state) => html`
                <button
                  type="button"
                  class="tab tab-sm cr-tab ${this.stateFilter === state ? "tab-active" : ""}"
                  ?disabled=${!this.selectedRepository}
                  @click=${() => this.emit("state-filter-change", state)}
                >
                  ${this.formatLabel(state)}
                </button>
              `
            )}
          </div>

          <label class="input input-bordered input-sm flex items-center gap-2 w-full">
            <cr-icon .icon=${Search} .size=${14}></cr-icon>
            <input
              type="search"
              class="grow text-sm"
              placeholder="Search ID, title, author, or branch"
              ?disabled=${!this.selectedRepository}
              .value=${this.searchTerm}
              @input=${(e: Event) => {
                this.emit("search-change", (e.target as HTMLInputElement).value);
              }}
            />
          </label>

          <div class="flex items-center justify-between gap-2 text-xs text-base-content/50">
            <span>${this.queueCountLabel(filtered.length)}</span>
          </div>

          <cr-review-list
            .provider=${this.provider}
            .targets=${filtered}
            .selectedId=${this.selectedTarget?.id ?? 0}
            .loading=${this.loadingTargets}
            .error=${this.targetsError}
            .configured=${this.configured}
            .emptyTitle=${this.selectedRepository ? "" : `${providerLabels[this.provider]} repository required`}
            .emptyDescription=${this.selectedRepository ? "" : `Choose a ${providerLabels[this.provider]} repository to load its review queue.`}
            @review-selected=${(e: CustomEvent<ReviewTarget>) => this.emit("target-selected", e.detail)}
          ></cr-review-list>
        </div>
      </section>
    `;
  }
}
