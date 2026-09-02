import { describe, expect, it, mock } from "bun:test";
import { createSvnClient } from "../packages/core/src/clients/svnClient.js";

describe("svn client", () => {
  it("uses the configured repository URL when fetching files", async () => {
    const fetchMock = mock(async () => new Response("guidelines", { status: 200 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const client = createSvnClient("https://svn.example.com/repos/project", "alice", "secret");
      const content = await client.getFile("GUIDELINES.md");

      expect(content).toBe("guidelines");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://svn.example.com/repos/project/GUIDELINES.md");
      expect(init).toBeDefined();
      expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
        "Basic YWxpY2U6c2VjcmV0"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
