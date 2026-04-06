import { describe, expect, it } from "bun:test";
import { dashboardAppPath, discussionThreadPath } from "./webContractPaths";

describe("web event contracts", () => {
  it("listens for the custom events emitted by interactive review components", async () => {
    const source = await Bun.file(dashboardAppPath).text();

    expect(source).toContain("@target-selected=");
    expect(source).toContain("@post-generated-review=");
    expect(source).toContain("@post-summary-comment=");
    expect(source).toContain("@post-inline-comment=");
    expect(source).toContain("@post-discussion-reply=");
    expect(source).toContain("@save-discussion-message-edit=");
    expect(source).toContain("@delete-discussion-message=");
  });

  it("renders reply timestamps using relative time formatting", async () => {
    const source = await Bun.file(discussionThreadPath).text();

    expect(source).toContain("const relativeTimestamp = timestamp");
    expect(source).toContain("this.formatRelativeTime(timestamp)");
    expect(source).toContain('"start-edit-discussion-message"');
    expect(source).toContain('"save-discussion-message-edit"');
    expect(source).toContain('"delete-discussion-message"');
    expect(source).not.toContain("${timestamp ? html`<span>${timestamp}</span>` : \"\"}");
  });
});
