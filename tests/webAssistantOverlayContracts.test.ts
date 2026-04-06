import { describe, expect, it } from "bun:test";
import {
  analysisRailPath,
  providerPagePath,
  stylesPath,
  workspacePanelPath,
} from "./webContractPaths";

describe("web assistant overlay contracts", () => {
  it("opens the AI Assistant from the selected review header instead of a fixed rail", async () => {
    const [workspaceSource, providerSource] = await Promise.all([
      Bun.file(workspacePanelPath).text(),
      Bun.file(providerPagePath).text(),
    ]);

    expect(workspaceSource).toContain("AI Assistant");
    expect(workspaceSource).toContain('this.emit("open-ai-assistant")');
    expect(workspaceSource).toContain("cr-ai-assistant-trigger");
    expect(providerSource).toContain('@open-ai-assistant=${() => { this.analysisPanelOpen = true; }}');
    expect(providerSource).toContain('.open=${this.analysisPanelOpen}');
    expect(providerSource).toContain('@close-analysis-panel=${() => { this.analysisPanelOpen = false; }}');
  });

  it("renders the assistant as a right-side overlay sheet with backdrop and tabs", async () => {
    const [analysisSource, stylesSource] = await Promise.all([
      Bun.file(analysisRailPath).text(),
      Bun.file(stylesPath).text(),
    ]);

    expect(analysisSource).toContain('class="cr-assistant-overlay"');
    expect(analysisSource).toContain('class="cr-assistant-overlay__backdrop"');
    expect(analysisSource).toContain('class="cr-assistant-overlay__panel"');
    expect(analysisSource).toContain("AI Assistant");
    expect(analysisSource).toContain("Merge request context");
    expect(stylesSource).toContain(".cr-assistant-overlay__panel");
    expect(stylesSource).toContain("position: fixed;");
    expect(stylesSource).toContain("height: 100dvh;");
    expect(stylesSource).toContain(".cr-assistant-overlay[data-open=\"true\"] .cr-assistant-overlay__panel");
    expect(stylesSource).toContain(".cr-ai-assistant-trigger::before");
  });
});
