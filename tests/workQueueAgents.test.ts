import { describe, expect, it, mock } from "bun:test";
import { makeCoreMock, makeWorkflowsMock } from "./mocks.ts";

const runReviewWorkflowMock = mock(async () => ({
  output: "gitlab review",
  contextLabel: "MR !7",
  inlineComments: [],
  selectedAgents: ["general", "security"],
  aggregated: true,
}));
const maybePostReviewCommentMock = mock(async () => null);
const runReviewBoardWorkflowMock = mock(async () => ({
  output: "rb review",
  contextLabel: "RR #42",
  inlineComments: [],
  selectedAgents: ["general", "security"],
  aggregated: true,
  rbUrl: "https://reviews.example.com",
  mrIid: 42,
}));
const maybePostReviewBoardCommentMock = mock(async () => null);

mock.module("@cr/workflows", () =>
  makeWorkflowsMock({
    runReviewWorkflow: runReviewWorkflowMock,
    maybePostReviewComment: maybePostReviewCommentMock,
    runReviewBoardWorkflow: runReviewBoardWorkflowMock,
    maybePostReviewBoardComment: maybePostReviewBoardCommentMock,
  })
);

mock.module("@cr/core", () =>
  makeCoreMock({
    logger: {
      success: () => {},
      error: () => {},
    },
    repoRootFromModule: () => "/mock/root",
  })
);

const { WorkQueue } = await import("../packages/server/src/workQueue.js");

describe("WorkQueue default review agents", () => {
  it("passes configured default agents into GitLab review jobs", async () => {
    const queue = new WorkQueue({
      gitlabUrl: "https://gitlab.example.com",
      gitlabKey: "gitlab-key",
      svnRepositoryUrl: "",
      svnUsername: "",
      svnPassword: "",
      rbUrl: "https://reviews.example.com",
      rbToken: "rb-token",
      webhookConcurrency: 1,
      webhookQueueLimit: 10,
      webhookJobTimeoutMs: 1000,
      openaiApiUrl: "https://api.example.com/v1",
      openaiApiKey: "openai-key",
      openaiModel: "gpt-4o",
      useCustomStreaming: false,
      defaultReviewAgents: ["general", "security"],
    });

    queue.enqueue("gitlab", "group/project", 7);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runReviewWorkflowMock).toHaveBeenCalledTimes(1);
    expect(runReviewWorkflowMock.mock.calls[0]?.[0]).toMatchObject({
      agentNames: ["general", "security"],
      agentMode: "multi",
      mrIid: 7,
    });
    expect(maybePostReviewCommentMock).toHaveBeenCalledTimes(1);
  });

  it("passes configured default agents into Review Board review jobs", async () => {
    const queue = new WorkQueue({
      gitlabUrl: "https://gitlab.example.com",
      gitlabKey: "gitlab-key",
      svnRepositoryUrl: "",
      svnUsername: "",
      svnPassword: "",
      rbUrl: "https://reviews.example.com",
      rbToken: "rb-token",
      webhookConcurrency: 1,
      webhookQueueLimit: 10,
      webhookJobTimeoutMs: 1000,
      openaiApiUrl: "https://api.example.com/v1",
      openaiApiKey: "openai-key",
      openaiModel: "gpt-4o",
      useCustomStreaming: false,
      defaultReviewAgents: ["general", "security"],
    });

    queue.enqueue("reviewboard", "demo-repo", 42);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runReviewBoardWorkflowMock).toHaveBeenCalledTimes(1);
    expect(runReviewBoardWorkflowMock.mock.calls[0]?.[0]).toMatchObject({
      agentNames: ["general", "security"],
      agentMode: "multi",
      mrIid: 42,
      provider: "reviewboard",
    });
    expect(maybePostReviewBoardCommentMock).toHaveBeenCalledTimes(1);
  });
});
