import { describe, expect, it, mock } from "bun:test";
import { resolveSvnFileUrl, svnGetFile } from "../packages/core/src/utils/svn.js";

describe("svn utils", () => {
  it("builds repository file URLs", () => {
    expect(resolveSvnFileUrl("https://svn.example.com/repos/project/", "/GUIDELINES.md")).toBe(
      "https://svn.example.com/repos/project/GUIDELINES.md"
    );
  });

  it("sends HTTP basic auth when credentials are provided", async () => {
    const fetchMock = mock(async (_url: string, _init?: RequestInit) => {
      return new Response("guidelines", { status: 200 });
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const content = await svnGetFile("https://svn.example.com/repos/project/GUIDELINES.md", {
        username: "alice",
        password: "secret",
      });

      expect(content).toBe("guidelines");
      const [, init] = fetchMock.mock.calls[0];
      expect(init).toBeDefined();
      expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
        "Basic YWxpY2U6c2VjcmV0"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
