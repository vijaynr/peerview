import { afterEach, describe, expect, it, mock } from "bun:test";
import { createHmac } from "node:crypto";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { startServer } from "../packages/server/src/server.js";
import { makeCoreMock, makeWorkflowsMock } from "./mocks.ts";

const REVIEW_BOARD_WEBHOOK_SECRET = "rb-webhook-secret";
const runtime = {
  gitlabUrl: "https://gitlab.example.com",
  gitlabKey: "mock-key",
  rbUrl: "https://reviews.example.com",
  rbToken: "rb-token",
  rbWebhookSecret: REVIEW_BOARD_WEBHOOK_SECRET,
  webhookConcurrency: 1,
  webhookQueueLimit: 50,
  webhookJobTimeoutMs: 600000,
  defaultReviewAgents: ["general", "security"],
};
const runReviewWorkflowMock = mock(async () => ({
  output: "Mocked GitLab review result",
  contextLabel: "Mocked MR",
  inlineComments: [],
  selectedAgents: ["general", "security"],
  aggregated: true,
}));
const runReviewBoardWorkflowMock = mock(async (input: unknown) => ({
  output: "Mocked Review Board review result",
  contextLabel: "Mocked RR",
  inlineComments: [],
  selectedAgents: ["general", "security"],
  aggregated: true,
  rbUrl: "https://reviews.example.com",
  mrIid:
    typeof input === "object" && input && "mrIid" in input
      ? Number((input as { mrIid: number }).mrIid)
      : 42,
}));

const maybePostReviewBoardCommentMock = mock(async () => null);
const loadDashboardDataMock = mock(async () => ({
  generatedAt: "2025-01-01T00:00:00.000Z",
  repository: {
    cwd: "/mock/repo",
    remoteUrl: "https://gitlab.example.com/group/project.git",
  },
  config: {
    openai: {
      configured: true,
      apiUrl: "https://api.example.com/v1",
      model: "gpt-4o",
    },
    gitlab: {
      configured: true,
      url: "https://gitlab.example.com",
    },
    github: {
      configured: true,
      url: "https://github.com",
    },
    reviewboard: {
      configured: true,
      url: "https://reviews.example.com",
    },
    webhook: {
      sslEnabled: false,
      concurrency: 1,
      queueLimit: 50,
      jobTimeoutMs: 600000,
    },
    defaultReviewAgents: ["general", "security"],
  },
  providers: {
    gitlab: {
      provider: "gitlab",
      configured: true,
      repository: "group/project",
      items: [],
    },
    github: {
      provider: "github",
      configured: true,
      repository: "owner/repo",
      items: [],
    },
    reviewboard: {
      provider: "reviewboard",
      configured: true,
      items: [
        {
          provider: "reviewboard",
          id: 42,
          title: "Demo review",
          url: "https://reviews.example.com/r/42/",
          state: "pending",
        },
      ],
    },
  },
}));

mock.module("@cr/workflows", () =>
  makeWorkflowsMock({
    runReviewWorkflow: runReviewWorkflowMock,
    maybePostReviewComment: async () => null,
    runReviewBoardWorkflow: runReviewBoardWorkflowMock,
    maybePostReviewBoardComment: maybePostReviewBoardCommentMock,
  })
);

mock.module("@cr/core", () =>
  makeCoreMock({
    loadWorkflowRuntime: async () => ({ ...runtime }),
    envOrConfig: (_key: string, value: string | undefined, fallback: string) => value || fallback,
    getCurrentBranch: async () => "feature/demo",
    getOriginRemoteUrl: async () => "https://gitlab.example.com/group/project.git",
    remoteToProjectPath: () => "group/project",
    createRuntimeReviewBoardClient: () => ({
      getReviewRequest: async () => ({}),
      getLatestDiffSet: async () => null,
      getFileDiffs: async () => [],
      getRawDiff: async () => "",
    }),
    loadDashboardData: loadDashboardDataMock,
    logger: {
      info: () => {},
      success: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
    repoRootFromModule: () => "/mock/root",
  })
);

const servers: Array<{ close: () => void }> = [];

afterEach(() => {
  while (servers.length > 0) {
    servers.pop()?.close();
  }
  runtime.gitlabUrl = "https://gitlab.example.com";
  runtime.gitlabKey = "mock-key";
  runtime.rbUrl = "https://reviews.example.com";
  runtime.rbToken = "rb-token";
  runtime.rbWebhookSecret = REVIEW_BOARD_WEBHOOK_SECRET;
  runReviewWorkflowMock.mockClear();
  runReviewBoardWorkflowMock.mockClear();
  maybePostReviewBoardCommentMock.mockClear();
  loadDashboardDataMock.mockClear();
});

function buildReviewBoardHeaders(body: string, extraHeaders: Record<string, string> = {}) {
  const signature = createHmac("sha256", REVIEW_BOARD_WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("hex");

  return {
    "Content-Type": "application/json",
    "X-ReviewBoard-Signature": `sha256=${signature}`,
    ...extraHeaders,
  };
}

async function findAvailablePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address() as AddressInfo | null;
      const port = address?.port;
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        if (!port) {
          reject(new Error("Could not determine an available port."));
          return;
        }
        resolve(port);
      });
    });
  });
}

async function startTestServer(options?: Parameters<typeof startServer>[1]) {
  const port = await findAvailablePort();
  const server = await startServer(port, options);
  servers.push(server);
  return { server, port };
}

describe("Webhook Server", () => {
  it("should respond correctly to a valid GitLab merge request event", async () => {
    const { port } = await startTestServer();

    const payload = {
      object_kind: "merge_request",
      event_type: "merge_request",
      project: {
        id: 118153,
      },
      object_attributes: {
        action: "open",
        iid: 7,
      },
    };

    const response = await fetch(`http://localhost:${port}/gitlab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gitlab-Token": "mock-key",
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(202);
    const json = await response.json();
    expect(json.status).toBe("accepted");
    expect(json.message).toBe("Review queued for processing");
  });

  it("should ignore non-merge-request events", async () => {
    const { port } = await startTestServer();

    const response = await fetch(`http://localhost:${port}/gitlab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gitlab-Token": "mock-key",
      },
      body: JSON.stringify({ object_kind: "push" }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Ignored non-merge-request event");
  });

  it("should accept a signed Review Board review_request_published event without requesting inline comments", async () => {
    const { port } = await startTestServer();

    const body = JSON.stringify({
      event: "review_request_published",
      review_request: {
        id: 42,
        repository: {
          name: "demo-repo",
        },
      },
    });

    const response = await fetch(`http://localhost:${port}/reviewboard`, {
      method: "POST",
      headers: buildReviewBoardHeaders(body),
      body,
    });

    expect(response.status).toBe(202);
    const json = await response.json();
    expect(json.status).toBe("accepted");
    expect(runReviewBoardWorkflowMock).toHaveBeenCalledTimes(1);
    expect(runReviewBoardWorkflowMock.mock.calls[0]?.[0]).toMatchObject({
      inlineComments: false,
      provider: "reviewboard",
      agentNames: ["general", "security"],
      agentMode: "multi",
    });
    expect(maybePostReviewBoardCommentMock).toHaveBeenCalledTimes(1);
    expect(maybePostReviewBoardCommentMock.mock.calls[0]?.[0]).toMatchObject({
      inlineComments: [],
      mrIid: 42,
      selectedAgents: ["general", "security"],
    });
  });

  it("should reject Review Board events with an invalid signature", async () => {
    const { port } = await startTestServer();

    const body = JSON.stringify({
      event: "review_request_published",
      review_request: {
        id: 42,
        repository: {
          name: "demo-repo",
        },
      },
    });

    const response = await fetch(`http://localhost:${port}/reviewboard`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ReviewBoard-Signature": "sha256=deadbeef",
      },
      body,
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });

  it("should reject Review Board events when the signature is missing", async () => {
    const { port } = await startTestServer();

    const body = JSON.stringify({
      event: "review_request_published",
      review_request: {
        id: 42,
        repository: {
          name: "demo-repo",
        },
      },
    });

    const response = await fetch(`http://localhost:${port}/reviewboard`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });

  it("should ignore signed Review Board review_published events to avoid loops", async () => {
    const { port } = await startTestServer();

    const body = JSON.stringify({
      event: "review_published",
      review_request: {
        id: 42,
        repository: {
          name: "demo-repo",
        },
      },
    });

    const response = await fetch(`http://localhost:${port}/reviewboard`, {
      method: "POST",
      headers: buildReviewBoardHeaders(body),
      body,
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Ignored Review Board event: review_published");
    expect(runReviewBoardWorkflowMock).not.toHaveBeenCalled();
  });

  it("should parse signed form-encoded Review Board events without a payload wrapper", async () => {
    const { port } = await startTestServer();

    const formBody = new URLSearchParams({
      event: "review_request_published",
      "review_request.id": "77",
      "review_request.repository.name": "demo-repo",
    }).toString();

    const response = await fetch(`http://localhost:${port}/reviewboard`, {
      method: "POST",
      headers: buildReviewBoardHeaders(formBody, {
        "Content-Type": "application/x-www-form-urlencoded",
      }),
      body: formBody,
    });

    expect(response.status).toBe(202);
    const json = await response.json();
    expect(json.status).toBe("accepted");
  });

  it("should reject only the workflow whose config is missing", async () => {
    runtime.rbToken = "";
    const { port } = await startTestServer();

    const reviewBoardResponse = await fetch(`http://localhost:${port}/reviewboard`, {
      method: "POST",
      headers: buildReviewBoardHeaders(
        JSON.stringify({
          event: "review_request_published",
          review_request: { id: 42, repository: { name: "demo-repo" } },
        })
      ),
      body: JSON.stringify({
        event: "review_request_published",
        review_request: { id: 42, repository: { name: "demo-repo" } },
      }),
    });

    const gitlabResponse = await fetch(`http://localhost:${port}/gitlab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gitlab-Token": "mock-key",
      },
      body: JSON.stringify({
        object_kind: "merge_request",
        object_attributes: { action: "open", iid: 9 },
        project: { id: 118153 },
      }),
    });

    expect(reviewBoardResponse.status).toBe(503);
    expect((await reviewBoardResponse.json()).message).toContain(
      "Missing Review Board configuration"
    );
    expect(gitlabResponse.status).toBe(202);
  });

  it("should return 405 for non-POST provider requests", async () => {
    const { port } = await startTestServer();

    const response = await fetch(`http://localhost:${port}/gitlab`, {
      method: "GET",
    });

    expect(response.status).toBe(405);
  });

  it("should return status for the unified server", async () => {
    const { port } = await startTestServer();

    const response = await fetch(`http://localhost:${port}/status`, {
      method: "GET",
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.routes.gitlab).toBe("/gitlab");
    expect(json.routes.reviewboard).toBe("/reviewboard");
  });

  it("should serve the web dashboard shell and data when web mode is enabled", async () => {
    const { port } = await startTestServer({ enableWeb: true, enableWebhook: false });

    const [htmlResponse, dataResponse, scriptResponse] = await Promise.all([
      fetch(`http://localhost:${port}/`, { method: "GET" }),
      fetch(`http://localhost:${port}/api/web/dashboard`, { method: "GET" }),
      fetch(`http://localhost:${port}/web/app.js`, { method: "GET" }),
    ]);

    expect(htmlResponse.status).toBe(200);
    expect(await htmlResponse.text()).toContain("<cr-dashboard-app>");

    expect(dataResponse.status).toBe(200);
    expect(await dataResponse.json()).toMatchObject({
      repository: { cwd: "/mock/repo" },
      providers: {
        reviewboard: {
          items: [{ id: 42, title: "Demo review" }],
        },
      },
    });

    expect(scriptResponse.status).toBe(200);
    expect(await scriptResponse.text()).toContain('customElements.define("cr-dashboard-app"');
    expect(loadDashboardDataMock).toHaveBeenCalledTimes(1);
  });
});
