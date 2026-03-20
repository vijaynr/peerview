import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  BrainCircuit,
  GitBranch,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Waypoints,
  Workflow,
  type IconNode,
} from "lucide";
import {
  providerLabels,
  providerOrder,
  type DashboardData,
  type DashboardSection,
  type UITheme,
} from "../types.js";
import "./cr-icon.js";
import "./cr-theme-toggle.js";

@customElement("cr-sidebar-nav")
export class CrSidebarNav extends LitElement {
  @property() activeSection: DashboardSection = "overview";
  @property({ attribute: false }) dashboard: DashboardData | null = null;
  @property({ type: Number }) selectedAgentCount = 0;
  @property() repositoryLabel = "";
  @property({ type: Boolean }) isLoading = false;
  @property() uiTheme: UITheme = "dark";

  override createRenderRoot() {
    return this;
  }

  private iconForSection(section: DashboardSection): IconNode {
    switch (section) {
      case "overview":
        return LayoutDashboard;
      case "gitlab":
        return Workflow;
      case "github":
        return GitBranch;
      case "reviewboard":
        return ShieldCheck;
      case "settings":
        return Settings2;
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

  private renderNavItem(section: DashboardSection, label: string) {
    const isActive = this.activeSection === section;
    return html`
      <li>
        <a
          href="#/${section}"
          class="${isActive
            ? "active bg-primary/10 text-primary font-semibold"
            : ""} flex items-center gap-2.5 rounded-lg cursor-pointer"
          @click=${(e: Event) => {
            e.preventDefault();
            this.emitSectionChange(section);
          }}
        >
          <cr-icon .icon=${this.iconForSection(section)} .size=${15}></cr-icon>
          ${label}
        </a>
      </li>
    `;
  }

  render() {
    const configuredProviders = providerOrder.filter(
      (p) => this.dashboard?.providers?.[p]?.configured
    ).length;

    return html`
      <aside
        class="border-r border-base-300/75 bg-base-200/96 w-64 min-h-screen flex flex-col gap-5 p-5 backdrop-blur-md"
      >
        <!-- Brand -->
        <div class="flex items-center gap-2 pt-1 pb-2 border-b border-base-300">
          <div
            class="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0"
          >
            <cr-icon
              .icon=${Waypoints}
              .size=${16}
              class="text-primary"
            ></cr-icon>
          </div>
          <div>
            <div class="font-bold text-sm tracking-tight">
              Code Review Platform
            </div>
            <div class="text-xs text-base-content/40">
              Review Command Center
            </div>
          </div>
          ${this.isLoading
            ? html`<span
                class="loading loading-spinner loading-xs text-primary ml-auto"
              ></span>`
            : ""}
        </div>

        <!-- Navigation -->
        <ul class="menu menu-sm p-0 gap-1 flex-none">
          ${this.renderNavItem("overview", "Overview")}
          ${providerOrder.map((p) =>
            this.renderNavItem(p, providerLabels[p])
          )}
          ${this.renderNavItem("settings", "Settings")}
        </ul>

        <!-- Workspace status -->
        <div class="flex flex-col gap-2 text-xs text-base-content/50">
          <div class="flex items-center gap-2">
            <cr-icon .icon=${Workflow} .size=${12}></cr-icon>
            <span>${configuredProviders}/3 providers configured</span>
          </div>
          <div class="flex items-center gap-2">
            <cr-icon .icon=${BrainCircuit} .size=${12}></cr-icon>
            <span>${this.selectedAgentCount || 1} active agents</span>
          </div>
          ${this.repositoryLabel
            ? html`
                <div class="flex items-center gap-2">
                  <cr-icon .icon=${GitBranch} .size=${12}></cr-icon>
                  <span class="truncate font-mono"
                    >${this.repositoryLabel}</span
                  >
                </div>
              `
            : ""}
        </div>

        <!-- Footer -->
        <div
          class="mt-auto flex flex-col gap-3 border-t border-base-300 pt-4"
        >
          <cr-theme-toggle .theme=${this.uiTheme}></cr-theme-toggle>
        </div>
      </aside>
    `;
  }
}
