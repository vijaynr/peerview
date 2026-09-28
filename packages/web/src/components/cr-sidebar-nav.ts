import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  BrainCircuit,
  GitBranch,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  X,
} from "lucide";
import {
  providerLabels,
  providerOrder,
  type DashboardData,
  type DashboardSection,
  type UITheme,
} from "../types.js";
import "./cr-icon.js";
import "./cr-provider-icon.js";
import "./cr-theme-toggle.js";

@customElement("cr-sidebar-nav")
export class CrSidebarNav extends LitElement {
  @property() activeSection: DashboardSection = "overview";
  @property({ attribute: false }) dashboard: DashboardData | null = null;
  @property({ type: Number }) selectedAgentCount = 0;
  @property() repositoryLabel = "";
  @property({ type: Boolean }) isLoading = false;
  @property() uiTheme: UITheme = "dark";
  @property({ type: Boolean }) collapsed = false;
  @property({ type: Boolean }) mobileOpen = false;

  override createRenderRoot() {
    return this;
  }

  private emitSectionChange(section: DashboardSection) {
    this.dispatchEvent(
      new CustomEvent("section-change", {
        detail: section,
        bubbles: true,
        composed: true,
      })
    );
  }

  private emitSidebarToggle() {
    this.dispatchEvent(new CustomEvent("sidebar-toggle", { bubbles: true, composed: true }));
  }

  private toggleMobileMenu() {
    this.mobileOpen = !this.mobileOpen;
  }

  private renderNavLink(section: DashboardSection, label: string) {
    const isActive = this.activeSection === section;
    const isProvider = section === "gitlab" || section === "github" || section === "reviewboard";

    return html`
      <a
        href="#/${section}"
        class="cr-sidebar-link flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors
          ${
            isActive
              ? "bg-primary/10 text-foreground font-semibold"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }"
        @click=${(e: Event) => {
          e.preventDefault();
          this.mobileOpen = false;
          this.emitSectionChange(section);
        }}
        aria-current=${isActive ? "page" : "false"}
        aria-label=${label}
        title=${this.collapsed ? label : ""}
      >
        <span class="flex-none w-4 flex items-center justify-center">
          ${
            isProvider
              ? html`<cr-provider-icon .provider=${section} .size=${15}></cr-provider-icon>`
              : html`<cr-icon
                .icon=${section === "overview" ? LayoutDashboard : Settings2}
                .size=${15}
              ></cr-icon>`
          }
        </span>
        <span class="cr-sidebar-label truncate">${label}</span>
      </a>
    `;
  }

  render() {
    const configuredProviders = providerOrder.filter(
      (p) => this.dashboard?.providers?.[p]?.configured
    ).length;

    const logo = html`
      <div class="flex items-center justify-between w-full gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="px-2 cr-sidebar-label font-semibold text-lg tracking-tight text-sidebar-foreground">PeerView</span>
        </div>
        <button
          type="button"
          class="cr-sidebar-toggle hidden lg:inline-flex"
          @click=${this.emitSidebarToggle}
          aria-label=${this.collapsed ? "Expand navigation" : "Collapse navigation"}
          title=${this.collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <cr-icon .icon=${this.collapsed ? PanelLeftOpen : PanelLeftClose} .size=${16}></cr-icon>
        </button>
      </div>
    `;

    const content = html`
      <nav class="flex flex-col gap-1 -mx-1 -mt-2" aria-label="Main navigation">
        ${this.renderNavLink("overview", "Overview")}
        ${providerOrder.map((p) => this.renderNavLink(p, providerLabels[p]))}
        ${this.renderNavLink("settings", "Settings")}
      </nav>

      <div class="cr-sidebar-meta flex flex-col gap-1.5 -mx-1 mt-3 pt-3 border-t border-sidebar-border">
        <div class="flex items-center gap-2 px-2.5 text-xs text-muted-foreground" title="${configuredProviders}/3 providers configured">
          <cr-icon .icon=${LayoutDashboard} .size=${12}></cr-icon>
          <span class="cr-sidebar-label">${configuredProviders}/3 providers</span>
          <span class="cr-sidebar-count">${configuredProviders}/3</span>
        </div>
        <div class="flex items-center gap-2 px-2.5 text-xs text-muted-foreground" title="${this.selectedAgentCount || 1} active agents">
          <cr-icon .icon=${BrainCircuit} .size=${12}></cr-icon>
          <span class="cr-sidebar-label">${this.selectedAgentCount || 1} agents</span>
          <span class="cr-sidebar-count">${this.selectedAgentCount || 1}</span>
        </div>
        ${
          this.repositoryLabel
            ? html`
              <div class="flex items-center gap-2 px-2.5 text-xs text-muted-foreground font-mono truncate" title=${this.repositoryLabel}>
                <cr-icon .icon=${GitBranch} .size=${12}></cr-icon>
                <span class="cr-sidebar-label truncate">${this.repositoryLabel}</span>
              </div>
            `
            : ""
        }
      </div>
    `;

    return html`
      <button
        type="button"
        class="cr-mobile-menu-button lg:hidden"
        @click=${this.toggleMobileMenu}
        aria-label="Open navigation"
      >
        <cr-icon .icon=${Menu} .size=${18}></cr-icon>
      </button>
      <div
        class="cr-mobile-menu-backdrop lg:hidden ${this.mobileOpen ? "" : "hidden"}"
        @click=${this.toggleMobileMenu}
      ></div>
      <aside
        class="cr-app-sidebar ${this.collapsed ? "cr-app-sidebar--collapsed" : ""} ${this.mobileOpen ? "cr-app-sidebar--mobile-open" : ""}"
        aria-label="PeerView navigation"
      >
        <div class="flex flex-col h-full">
          <div class="p-4">${logo}</div>
          <button
            type="button"
            class="cr-mobile-menu-close lg:hidden"
            @click=${this.toggleMobileMenu}
            aria-label="Close navigation"
          >
            <cr-icon .icon=${X} .size=${18}></cr-icon>
          </button>
          <div class="flex-1 overflow-y-auto p-4 space-y-4">${content}</div>
          <div class="cr-sidebar-theme-dock p-4">
            <cr-theme-toggle .theme=${this.uiTheme} .compact=${this.collapsed}></cr-theme-toggle>
          </div>
        </div>
      </aside>
    `;
  }
}
