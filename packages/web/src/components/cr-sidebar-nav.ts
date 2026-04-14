import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  BrainCircuit,
  GitBranch,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  type IconNode,
} from "lucide";
import {
  providerLabels,
  providerOrder,
  type DashboardData,
  type DashboardSection,
  type UITheme,
} from "../types.js";
import { WEB_APP_ICON_ROUTE } from "../asset-routes.js";
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

  override createRenderRoot() {
    return this;
  }

  private iconForSection(section: DashboardSection): IconNode {
    switch (section) {
      case "overview":
        return LayoutDashboard;
      case "settings":
        return Settings2;
      default:
        return LayoutDashboard;
    }
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

  private emitToggleSidebar() {
    this.dispatchEvent(
      new CustomEvent("toggle-sidebar", {
        bubbles: true,
        composed: true,
      })
    );
  }

  private renderNavItem(section: DashboardSection, label: string) {
    const isActive = this.activeSection === section;
    const isProvider =
      section === "gitlab" || section === "github" || section === "reviewboard";

    return html`
      <a
        href="#/${section}"
        class="cr-app-sidebar__nav-link ${isActive
          ? "cr-app-sidebar__nav-link--active"
          : ""}"
        title=${label}
        aria-label=${label}
        @click=${(e: Event) => {
          e.preventDefault();
          this.emitSectionChange(section);
        }}
      >
        <span class="cr-app-sidebar__nav-icon">
          ${isProvider
            ? html`
                <cr-provider-icon
                  .provider=${section}
                  .size=${15}
                ></cr-provider-icon>
              `
            : html`
                <cr-icon
                  .icon=${this.iconForSection(section)}
                  .size=${15}
                ></cr-icon>
              `}
        </span>
        <span class="cr-app-sidebar__label">${label}</span>
      </a>
    `;
  }

  private renderSidebarToggle() {
    const isCollapsed = this.collapsed;
    const label = isCollapsed ? "Expand sidebar" : "Collapse sidebar";

    return html`
      <button
        type="button"
        class="cr-app-sidebar__toggle"
        aria-label=${label}
        title=${label}
        @click=${() => this.emitToggleSidebar()}
      >
        ${isCollapsed
          ? html`
              <span class="cr-app-sidebar__toggle-icon" aria-hidden="true">
                <cr-icon .icon=${PanelLeftOpen} .size=${14}></cr-icon>
              </span>
            `
          : html`
              <span class="cr-app-sidebar__toggle-icon" aria-hidden="true">
                <cr-icon .icon=${PanelLeftClose} .size=${14}></cr-icon>
              </span>
            `}
      </button>
    `;
  }

  render() {
    const configuredProviders = providerOrder.filter(
      (p) => this.dashboard?.providers?.[p]?.configured
    ).length;

    return html`
      <aside
        class="cr-app-sidebar ${this.collapsed ? "cr-app-sidebar--collapsed" : ""}"
      >
        <div class="cr-app-sidebar__header electrobun-webkit-app-region-drag">
          <div class="cr-app-sidebar__brand electrobun-webkit-app-region-no-drag">
            ${this.collapsed
              ? ""
              : html`<img
                  src=${WEB_APP_ICON_ROUTE}
                  alt="PeerView"
                  width="40"
                  height="40"
                  class="cr-app-sidebar__brand-mark"
                />`}
            <div class="cr-app-sidebar__brand-copy">
              <div class="cr-app-sidebar__brand-title">
                PeerView
              </div>
            </div>
          </div>
          <div class="cr-app-sidebar__header-actions electrobun-webkit-app-region-no-drag">
            ${this.renderSidebarToggle()}
          </div>
        </div>

        <nav class="cr-app-sidebar__nav" aria-label="Main navigation">
          ${this.renderNavItem("overview", "Overview")}
          ${providerOrder.map((p) =>
            this.renderNavItem(p, providerLabels[p])
          )}
          ${this.renderNavItem("settings", "Settings")}
        </nav>

        ${this.collapsed
          ? ""
          : html`
              <div class="cr-app-sidebar__status">
                <div
                  class="cr-app-sidebar__status-item"
                  title="${configuredProviders}/3 providers configured"
                >
                  <cr-icon .icon=${LayoutDashboard} .size=${12}></cr-icon>
                  <span class="cr-app-sidebar__label"
                    >${configuredProviders}/3 providers configured</span
                  >
                </div>
                <div
                  class="cr-app-sidebar__status-item"
                  title="${this.selectedAgentCount || 1} active agents"
                >
                  <cr-icon .icon=${BrainCircuit} .size=${12}></cr-icon>
                  <span class="cr-app-sidebar__label"
                    >${this.selectedAgentCount || 1} active agents</span
                  >
                </div>
                ${this.repositoryLabel
                  ? html`
                      <div
                        class="cr-app-sidebar__status-item"
                        title=${this.repositoryLabel}
                      >
                        <cr-icon .icon=${GitBranch} .size=${12}></cr-icon>
                        <span class="cr-app-sidebar__label truncate font-mono"
                          >${this.repositoryLabel}</span
                        >
                      </div>
                    `
                  : ""}
              </div>
            `}

        <div class="cr-app-sidebar__footer">
          <cr-theme-toggle
            .theme=${this.uiTheme}
          ></cr-theme-toggle>
        </div>
      </aside>
    `;
  }
}
