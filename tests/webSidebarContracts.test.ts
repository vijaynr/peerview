import { describe, expect, it } from "bun:test";
import { dashboardAppPath, sidebarPath, stylesPath } from "./webContractPaths";

describe("web sidebar contracts", () => {
  it("uses the custom sidebar navigation component", async () => {
    const source = await Bun.file(sidebarPath).text();

    expect(source).toContain('class="cr-app-sidebar');
    expect(source).toContain('class="cr-mobile-menu-button');
    expect(source).toContain('aria-label="PeerView navigation"');
    expect(source).not.toContain("WEB_APP_ICON_ROUTE");
    expect(source).not.toContain("<img");
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
