import { describe, expect, it } from "bun:test";
import {
  chatPanelPath,
  discussionThreadPath,
  reviewPanelPath,
  stylesPath,
  summaryPanelPath,
  workspacePanelPath,
} from "./webContractPaths";

describe("web markdown contracts", () => {
  it("uses shared markdown utility classes across app surfaces", async () => {
    const [reviewSource, summarySource, workspaceSource, chatSource, discussionSource] =
      await Promise.all([
        Bun.file(reviewPanelPath).text(),
        Bun.file(summaryPanelPath).text(),
        Bun.file(workspacePanelPath).text(),
        Bun.file(chatPanelPath).text(),
        Bun.file(discussionThreadPath).text(),
      ]);

    expect(reviewSource).toContain('className: "cr-markdown--muted"');
    expect(summarySource).toContain('className: "cr-markdown--muted"');
    expect(workspaceSource).toContain('className: "cr-markdown--muted"');
    expect(chatSource).toContain('className: "cr-markdown--muted"');
    expect(discussionSource).toContain(
      'className: "cr-discussion-message__markdown cr-markdown--muted"',
    );
    expect(reviewSource).not.toContain("text-xs text-base-content/70");
    expect(reviewSource).not.toContain("text-sm text-base-content/80");
    expect(chatSource).not.toContain("text-sm text-base-content/82");
  });

  it("defines a shared markdown scale and muted variant in styles", async () => {
    const stylesSource = await Bun.file(stylesPath).text();

    expect(stylesSource).toContain("--cr-markdown-size: 0.92rem;");
    expect(stylesSource).toContain(".cr-markdown--compact {");
    expect(stylesSource).toContain("--cr-markdown-size: 0.875rem;");
    expect(stylesSource).toContain(".cr-markdown--muted {");
    expect(stylesSource).toContain("--cr-markdown-color: rgb(226 232 240 / 0.82);");
    expect(stylesSource).toContain('html[data-theme="cr-light"] .cr-markdown--muted {');
  });
});
