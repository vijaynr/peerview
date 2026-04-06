import { describe, expect, it } from "bun:test";
import { diffViewerPath, stylesPath, workspacePanelPath } from "./webContractPaths";

describe("web diff viewer contracts", () => {
  it("keeps multiple diff files expanded instead of collapsing to a single file", async () => {
    const source = await Bun.file(diffViewerPath).text();

    expect(source).toContain(
      "const nextExpanded = this.expandedFileIds.filter((fileId) =>",
    );
    expect(source).toContain("!nextExpanded.includes(this.selectedFileId)");
    expect(source).toContain(
      "this.expandedFileIds = [...this.expandedFileIds, file.id];",
    );
    expect(source).not.toContain("this.expandedFileIds = [file.id];");
  });

  it("uses an explicit horizontal scroll container for wide diffs", async () => {
    const source = await Bun.file(stylesPath).text();

    expect(source).toContain(".cr-diff-viewer__code-scroll");
    expect(source).toContain("overflow-x: scroll;");
    expect(source).toContain("scrollbar-gutter: stable both-edges;");
    expect(source).toContain(".cr-diff-viewer__code-scroll::-webkit-scrollbar");
    expect(source).toContain("width: max-content;");
  });

  it("keeps vertical scrolling inside the diff workspace instead of the page shell", async () => {
    const [workspaceSource, stylesSource] = await Promise.all([
      Bun.file(workspacePanelPath).text(),
      Bun.file(stylesPath).text(),
    ]);

    expect(workspaceSource).toContain(
      'class="cr-review-workspace-panel relative h-full min-h-0',
    );
    expect(workspaceSource).toContain(
      'class="relative flex h-full min-h-0 flex-col overflow-hidden"',
    );
    expect(stylesSource).toContain(".cr-provider-stage {");
    expect(stylesSource).toContain("flex: 1 1 auto;");
    expect(stylesSource).toContain(".cr-review-workspace-panel {");
    expect(stylesSource).toContain("height: 100%;");
    expect(stylesSource).toContain("overflow: hidden;");
  });

  it("emits inline comment anchors from the clicked diff row button", async () => {
    const source = await Bun.file(diffViewerPath).text();

    expect(source).toContain("const rect = button.getBoundingClientRect();");
    expect(source).toContain("anchorTop: rect.top + rect.height / 2,");
    expect(source).toContain("anchorLeft: rect.left,");
  });
});
