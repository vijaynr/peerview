import { describe, expect, it } from "bun:test";
import { dashboardAppPath, sidebarPath, stylesPath } from "./webContractPaths";

describe("web sidebar contracts", () => {
  it("renders the responsive custom sidebar navigation", async () => {
    const source = await Bun.file(sidebarPath).text();

    expect(source).toContain('<aside');
    expect(source).toContain('aria-label="PeerView navigation"');
    expect(source).toContain("cr-mobile-menu-button");
    expect(source).toContain("cr-mobile-menu-backdrop");
    expect(source).toContain("<cr-theme-toggle");
    expect(source).toContain(".theme=${this.uiTheme}");
    expect(source).toContain("PeerView");
  });

  it("renders sidebar nav items for all providers and sections", async () => {
    const source = await Bun.file(sidebarPath).text();

    expect(source).toContain('renderNavLink("overview"');
    expect(source).toContain('renderNavLink("settings"');
    expect(source).toContain("providerOrder.map");
    expect(source).toContain("section-change");
  });

  it("applies sidebar styling via className and offsets main content", async () => {
    const [stylesSource, appSource] = await Promise.all([
      Bun.file(stylesPath).text(),
      Bun.file(dashboardAppPath).text(),
    ]);

    expect(stylesSource).toContain(".cr-app-sidebar");
    expect(appSource).toContain("lg:ml-72");
  });
});
