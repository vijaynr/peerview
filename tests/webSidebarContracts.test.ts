import { describe, expect, it } from "bun:test";
import { dashboardAppPath, indexPath, sidebarPath, stylesPath } from "./webContractPaths";

describe("web sidebar contracts", () => {
  it("supports a collapsible icon-first sidebar component", async () => {
    const source = await Bun.file(sidebarPath).text();

    expect(source).toContain("@property({ type: Boolean }) collapsed = false;");
    expect(source).toContain('new CustomEvent("toggle-sidebar"');
    expect(source).toContain('class="cr-app-sidebar ${this.collapsed ? "cr-app-sidebar--collapsed" : ""}"');
    expect(source).toContain('class="cr-app-sidebar__toggle"');
    expect(source).toContain('class="cr-app-sidebar__toggle-bar"');
    expect(source).toContain("<cr-theme-toggle");
    expect(source).toContain(".theme=${this.uiTheme}");
    expect(source).toContain('this.collapsed\n          ? ""');
    expect(source).not.toContain("cr-app-sidebar__toggle-label");
  });

  it("persists the desktop sidebar collapsed state in the dashboard app", async () => {
    const source = await Bun.file(dashboardAppPath).text();

    expect(source).toContain('@state() sidebarCollapsed = true;');
    expect(source).toContain('window.localStorage.getItem("pv:web-sidebar-collapsed")');
    expect(source).toContain('window.localStorage.setItem(');
    expect(source).toContain("@toggle-sidebar=${() => this.toggleSidebarCollapsed()}");
    expect(source).toContain("--cr-sidebar-shell-width:");
  });

  it("styles the sidebar as frosted glass and changes host width on desktop", async () => {
    const [stylesSource, indexSource] = await Promise.all([
      Bun.file(stylesPath).text(),
      Bun.file(indexPath).text(),
    ]);

    expect(stylesSource).toContain(".cr-app-sidebar {");
    expect(stylesSource).toContain("backdrop-filter: blur(22px) saturate(165%);");
    expect(stylesSource).toContain(".cr-app-sidebar--collapsed .cr-app-sidebar__label");
    expect(stylesSource).toContain(".cr-theme-btn {");
    expect(stylesSource).toContain(".cr-app-sidebar__toggle {");
    expect(stylesSource).toContain(".cr-app-sidebar__toggle-bar {");
    expect(indexSource).toContain("width: var(--cr-sidebar-shell-width, 16rem);");
  });
});
