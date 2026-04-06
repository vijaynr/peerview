import { describe, expect, it } from "bun:test";
import { popoverPath, stylesPath } from "./webContractPaths";

describe("web inline comment popover contracts", () => {
  it("positions the popover using the selected line anchor coordinates", async () => {
    const source = await Bun.file(popoverPath).text();

    expect(source).toContain("anchorTop: number;");
    expect(source).toContain("anchorLeft: number;");
    expect(source).toContain("const popoverWidth = Math.min(384, window.innerWidth - 32);");
    expect(source).toContain("--cr-inline-comment-popover-left:${left}px;");
    expect(source).toContain("--cr-inline-comment-popover-top:${top}px;");
  });

  it("uses fixed positioning on desktop and a bottom-sheet fallback on smaller screens", async () => {
    const source = await Bun.file(stylesPath).text();

    expect(source).toContain(".cr-inline-comment-popover {");
    expect(source).toContain("position: fixed;");
    expect(source).toContain("left: var(--cr-inline-comment-popover-left, 1rem);");
    expect(source).toContain("top: var(--cr-inline-comment-popover-top, 1rem);");
    expect(source).toContain("top: auto;");
  });
});
