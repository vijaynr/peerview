import { LitElement, html } from "lit";
import { ChevronDown, RefreshCw, Search } from "lucide";
import type { ProviderId, ProviderRepositoryOption } from "../types.js";
import "./cr-icon.js";

export class CrProviderRepositoryPicker extends LitElement {
  static properties = {
    provider: {},
    options: { attribute: false },
    selectedId: {},
    loading: { type: Boolean },
    error: {},
    open: { state: true },
    query: { state: true },
  };

  override createRenderRoot() {
    return this;
  }

  declare provider: ProviderId;
  declare options: ProviderRepositoryOption[];
  declare selectedId: string;
  declare loading: boolean;
  declare error: string;
  declare open: boolean;
  declare query: string;

  private readonly handleWindowPointerDownBound = (event: PointerEvent) => {
    if (!this.open) {
      return;
    }

    const path = event.composedPath();
    if (!path.includes(this)) {
      this.open = false;
    }
  };

  constructor() {
    super();
    this.provider = "gitlab";
    this.options = [];
    this.selectedId = "";
    this.loading = false;
    this.error = "";
    this.open = false;
    this.query = "";
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("pointerdown", this.handleWindowPointerDownBound);
  }

  disconnectedCallback() {
    window.removeEventListener("pointerdown", this.handleWindowPointerDownBound);
    super.disconnectedCallback();
  }

  private get selectedOption() {
    return this.options.find((option) => option.id === this.selectedId) ?? null;
  }

  private get filteredOptions() {
    const query = this.query.trim().toLowerCase();
    if (!query) {
      return this.options;
    }

    return this.options.filter((option) =>
      [option.label, option.subtitle, option.description, option.visibility]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    );
  }

  private get placeholderLabel() {
    switch (this.provider) {
      case "gitlab":
        return "Select a GitLab project";
      case "github":
        return "Select a GitHub repository";
      default:
        return "Select a Review Board repository";
    }
  }

  private formatLabel(value: string) {
    const normalized = value.replace(/[_-]+/g, " ").trim();
    if (!normalized) {
      return "";
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private selectedCaption(option: ProviderRepositoryOption | null) {
    if (!option) {
      if (this.loading) {
        return "Loading repositories…";
      }

      if (this.options.length > 0) {
        return `${this.options.length} repositories available`;
      }

      return "Open the selector to search repositories";
    }

    const meta = [
      option.visibility
        ? this.formatLabel(option.visibility)
        : option.private !== undefined
          ? option.private
            ? "Private"
            : "Public"
          : "",
      option.defaultBranch || "",
    ].filter(Boolean);

    if (meta.length > 0) {
      return meta.join(" · ");
    }

    return "Repository selected";
  }

  private emitRefresh() {
    this.dispatchEvent(
      new CustomEvent("provider-repository-refresh", {
        bubbles: true,
        composed: true,
      })
    );
  }

  private emitSelected(option: ProviderRepositoryOption) {
    this.dispatchEvent(
      new CustomEvent<ProviderRepositoryOption>("provider-repository-selected", {
        detail: option,
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleToggle() {
    if (this.loading) {
      return;
    }

    this.open = !this.open;
    if (this.open) {
      this.query = "";
    }
  }

  private handleOptionSelected(option: ProviderRepositoryOption) {
    this.emitSelected(option);
    this.open = false;
    this.query = "";
  }

  render() {
    const selected = this.selectedOption;

    return html`
      <div class="cr-provider-picker relative flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="cr-provider-picker__trigger btn btn-sm min-h-11 flex-1 items-center justify-between gap-3 rounded-[0.55rem] border border-base-300 bg-base-200/80 px-3 text-left"
            @click=${() => this.handleToggle()}
            aria-expanded=${String(this.open)}
            aria-haspopup="listbox"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-base-content/92">
                ${selected?.label || this.placeholderLabel}
              </div>
              <div class="truncate text-xs text-base-content/50">
                ${this.selectedCaption(selected)}
              </div>
            </div>
            <span class="shrink-0 text-base-content/45 transition-transform duration-200 ${this.open ? "rotate-180" : ""}">
              <cr-icon .icon=${ChevronDown} .size=${16}></cr-icon>
            </span>
          </button>

          <button
            type="button"
            class="btn btn-sm btn-ghost min-h-11 rounded-[0.55rem] border border-base-300 bg-base-200/72 px-3"
            @click=${() => this.emitRefresh()}
            ?disabled=${this.loading}
            aria-label="Refresh repositories"
            title="Refresh repositories"
          >
            ${this.loading
              ? html`<span class="loading loading-spinner loading-xs text-primary"></span>`
              : html`<cr-icon .icon=${RefreshCw} .size=${15}></cr-icon>`}
          </button>
        </div>

        ${this.error
          ? html`<div class="rounded-[0.55rem] border border-error/20 bg-error/10 px-3 py-2 text-xs text-error-content">${this.error}</div>`
          : ""}

        ${this.open
          ? html`
              <div class="cr-provider-picker__panel absolute left-0 right-0 top-full z-20 mt-1.5 rounded-[0.75rem] border border-base-300 bg-base-200/98 p-3 backdrop-blur-md" style="box-shadow:var(--cr-shadow-3)">
                <label class="input input-sm flex h-10 w-full items-center gap-2 rounded-[0.55rem] border border-base-300 bg-base-100/60 px-3">
                  <cr-icon .icon=${Search} .size=${14}></cr-icon>
                  <input
                    type="search"
                    class="grow text-sm"
                    placeholder="Search repositories"
                    .value=${this.query}
                    @input=${(event: Event) => {
                      this.query = (event.target as HTMLInputElement).value;
                    }}
                  />
                </label>

                <div class="mt-2 max-h-72 overflow-y-auto pr-1">
                  ${this.filteredOptions.length > 0
                    ? html`
                        <div class="flex flex-col gap-1">
                          ${this.filteredOptions.map(
                            (option) => html`
                              <button
                                type="button"
                                class="flex w-full flex-col gap-1 rounded-[0.55rem] border px-3 py-2.5 text-left transition-colors ${option.id === this.selectedId
                                  ? "border-primary/35 bg-primary/10"
                                  : "border-base-300/60 bg-base-100/30 hover:border-primary/22 hover:bg-base-100/60"}"
                                @click=${() => this.handleOptionSelected(option)}
                              >
                                <div class="flex items-center justify-between gap-2">
                                  <span class="truncate text-sm font-semibold text-base-content/92">
                                    ${option.label}
                                  </span>
                                  ${option.visibility || option.private !== undefined
                                    ? html`
                                        <span class="badge badge-ghost badge-xs shrink-0">
                                          ${option.visibility
                                            ? this.formatLabel(option.visibility)
                                            : option.private
                                              ? "Private"
                                              : "Public"}
                                        </span>
                                      `
                                    : ""}
                                </div>
                                <div class="truncate text-xs text-base-content/55">
                                  ${option.description || option.subtitle || "No extra repository detail"}
                                </div>
                              </button>
                            `
                          )}
                        </div>
                      `
                    : html`
                        <div class="cr-empty-state" style="min-height:6rem">
                          <div class="cr-empty-state__icon"><cr-icon .icon=${Search} .size=${18}></cr-icon></div>
                          <div class="cr-empty-state__description">
                            ${this.options.length === 0
                              ? "No repositories are available for this provider yet."
                              : "No repositories match this search."}
                          </div>
                        </div>
                      `}
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }
}

customElements.define("cr-provider-repository-picker", CrProviderRepositoryPicker);
