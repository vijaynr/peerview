import { describe, expect, it } from "bun:test";
import { stylesPath, themeTogglePath } from "./webContractPaths";

describe("web theme toggle contracts", () => {
  it("renders the theme toggle as an icon button", async () => {
    const source = await Bun.file(themeTogglePath).text();

    expect(source).toContain('class="cr-theme-btn"');
    expect(source).toContain("aria-label=${nextLabel}");
    expect(source).toContain("data-theme=${this.theme}");
    expect(source).toContain('new CustomEvent("theme-toggle"');
    expect(source).not.toContain("cr-theme-toggle__track");
    expect(source).not.toContain("cr-theme-toggle__thumb");
    expect(source).not.toContain("cr-theme-toggle__label");
    expect(source).not.toContain("compact");
  });

  it("defines icon button styling with light theme variant", async () => {
    const source = await Bun.file(stylesPath).text();

    expect(source).toContain(".cr-theme-btn {");
    expect(source).toContain(".cr-theme-btn:hover {");
    expect(source).toContain('.cr-theme-btn[data-theme="light"]');
    expect(source).toContain('html[data-theme="cr-light"] .cr-theme-btn {');
    expect(source).not.toContain(".cr-theme-toggle__track {");
    expect(source).not.toContain(".cr-theme-toggle__thumb {");
  });
});
