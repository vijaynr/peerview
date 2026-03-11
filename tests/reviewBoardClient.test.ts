import { describe, expect, it, mock } from "bun:test";
import { createReviewBoardClient } from "../packages/reviewboard/src/client.js";

describe("reviewboard client", () => {
  it("hydrates repository.path from the linked repository resource", async () => {
    const fetchMock = mock(async (url: string) => {
      if (url.endsWith("/api/review-requests/123/?expand=submitter,repository")) {
        return new Response(
          JSON.stringify({
            review_request: {
              id: 123,
              summary: "SVN review",
              description: "desc",
              status: "pending",
              absolute_url: "https://reviews.example.com/r/123/",
              submitter: { username: "alice", title: "Alice" },
              repository: { title: "Project SVN", name: "project-svn" },
              links: {
                diffs: { href: "/api/review-requests/123/diffs/" },
                reviews: { href: "/api/review-requests/123/reviews/" },
                repository: { href: "/api/repositories/9/" },
              },
            },
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/repositories/9/")) {
        return new Response(
          JSON.stringify({
            repository: {
              id: 9,
              title: "Project SVN",
              name: "project-svn",
              path: "https://svn.example.com/repos/project",
            },
          }),
          { status: 200 }
        );
      }

      return new Response("not found", { status: 404 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const client = createReviewBoardClient("https://reviews.example.com", "token-123");
      const request = await client.getReviewRequest(123);

      expect(request.repository?.path).toBe("https://svn.example.com/repos/project");
      expect(fetchMock.mock.calls).toHaveLength(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("creates, uploads, updates, and publishes review requests via REST", async () => {
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/repositories/?max-results=200")) {
        return new Response(
          JSON.stringify({
            repositories: [
              {
                id: 9,
                title: "Project SVN",
                name: "project-svn",
                path: "https://svn.example.com/repos/project",
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/review-requests/") && init?.method === "POST") {
        const body = init.body as URLSearchParams;
        expect(body.get("repository")).toBe("9");
        return new Response(
          JSON.stringify({
            review_request: {
              id: 321,
              summary: "",
              description: "",
              status: "pending",
              absolute_url: "https://reviews.example.com/r/321/",
              submitter: { username: "alice", title: "Alice" },
              links: {
                diffs: { href: "/api/review-requests/321/diffs/" },
                reviews: { href: "/api/review-requests/321/reviews/" },
              },
            },
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/review-requests/321/draft/diffs/") && init?.method === "POST") {
        expect(init.body instanceof FormData).toBe(true);
        const form = init.body as FormData;
        expect(form.get("basedir")).toBe("/trunk");
        expect(form.get("path")).toBeInstanceOf(File);
        return new Response(
          JSON.stringify({
            diff: {
              id: 88,
              revision: 1,
              links: { files: { href: "/api/review-requests/321/diffs/1/files/" } },
            },
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/api/review-requests/321/draft/") && init?.method === "PUT") {
        const body = init.body as URLSearchParams;
        if (body.get("public") === "1") {
          return new Response(
            JSON.stringify({
              review_request: {
                id: 321,
                summary: "SVN change summary",
                description: "Body",
                status: "pending",
                absolute_url: "https://reviews.example.com/r/321/",
                submitter: { username: "alice", title: "Alice" },
                links: {
                  diffs: { href: "/api/review-requests/321/diffs/" },
                  reviews: { href: "/api/review-requests/321/reviews/" },
                },
              },
            }),
            { status: 200 }
          );
        }

        expect(body.get("summary")).toBe("SVN change summary");
        expect(body.get("description")).toBe("Body");
        expect(body.get("description_text_type")).toBe("markdown");
        return new Response(
          JSON.stringify({
            review_request: {
              id: 321,
              summary: "SVN change summary",
              description: "Body",
              status: "pending",
              absolute_url: "https://reviews.example.com/r/321/",
              submitter: { username: "alice", title: "Alice" },
              links: {
                diffs: { href: "/api/review-requests/321/diffs/" },
                reviews: { href: "/api/review-requests/321/reviews/" },
              },
            },
          }),
          { status: 200 }
        );
      }

      return new Response("not found", { status: 404 });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const client = createReviewBoardClient("https://reviews.example.com", "token-123");
      const repositories = await client.listRepositories();
      expect(repositories[0]?.id).toBe(9);

      const request = await client.createReviewRequest(9);
      expect(request.id).toBe(321);

      const diff = await client.uploadReviewRequestDiff(321, "Index: a.ts", "/trunk");
      expect(diff.id).toBe(88);

      const updated = await client.updateReviewRequestDraft(321, {
        summary: "SVN change summary",
        description: "Body",
      });
      expect(updated.summary).toBe("SVN change summary");

      const published = await client.publishReviewRequest(321);
      expect(published.absolute_url).toBe("https://reviews.example.com/r/321/");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
