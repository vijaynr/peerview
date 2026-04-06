import { describe, expect, it } from "bun:test";
import { reviewPanelPath, stylesPath } from "./webContractPaths";

describe("web review panel contracts", () => {
  it("renders review output as flowing sections with a sticky action bar", async () => {
    const source = await Bun.file(reviewPanelPath).text();

    expect(source).toContain('class="cr-review-panel"');
    expect(source).toContain("Overall Review");
    expect(source).toContain("result.agentResults?.map(");
    expect(source).toContain('class="cr-review-section"');
    expect(source).toContain('class="cr-review-actions"');
    expect(source).toContain('class="cr-review-info-banner"');
  });

  it("provides a single scroll area with agent selection and sticky actions", async () => {
    const source = await Bun.file(stylesPath).text();

    expect(source).toContain(".cr-review-scroll");
    expect(source).toContain("overflow-y: auto;");
    expect(source).toContain(".cr-review-section");
    expect(source).toContain(".cr-review-actions");
    expect(source).toContain(".cr-review-agents");
    expect(source).toContain(".cr-review-info-banner");
  });
});
