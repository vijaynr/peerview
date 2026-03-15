import { beforeEach, describe, expect, it, mock } from "bun:test";
import { makeCoreMock } from "./mocks.ts";

const rbCallLog: string[] = [];
const isSvnWorkingCopyMock = mock(async () => true);
const getSvnDiffMock = mock(async () => "Index: src/file.ts\n+change");
const getSvnRepoRootUrlMock = mock(async () => "https://svn.example.com/repos/project");
const getSvnWorkingCopyUrlMock = mock(async () => "https://svn.example.com/repos/project/trunk");
const createRuntimeLlmClientMock = mock(() => ({
  generate: async (prompt: string) =>
    prompt.startsWith("Generate a concise") ? "Title" : "Description",
}));
const createRuntimeReviewBoardClientMock = mock(() => rbClient);

const rbClient = {
  listRepositories: mock(async () => [
    {
      id: 9,
      title: "Project SVN",
      name: "project-svn",
      path: "https://svn.example.com/repos/project",
    },
  ]),
  createReviewRequest: mock(async (_repositoryId: number) => {
    rbCallLog.push("create");
    return {
      id: 77,
      summary: "",
      description: "",
      status: "pending",
      absolute_url: "https://reviews.example.com/r/77/",
      submitter: { username: "alice", title: "Alice" },
      links: {
        diffs: { href: "/api/review-requests/77/diffs/" },
        reviews: { href: "/api/review-requests/77/reviews/" },
      },
    };
  }),
  uploadReviewRequestDiff: mock(async () => {
    rbCallLog.push("upload");
    return {
      id: 5,
      revision: 1,
      links: { files: { href: "/api/review-requests/77/diffs/1/files/" } },
    };
  }),
  updateReviewRequestDraft: mock(async () => {
    rbCallLog.push("update");
    return {
      id: 77,
      summary: "Title",
      description: "Description",
      status: "pending",
      absolute_url: "https://reviews.example.com/r/77/",
      submitter: { username: "alice", title: "Alice" },
      links: {
        diffs: { href: "/api/review-requests/77/diffs/" },
        reviews: { href: "/api/review-requests/77/reviews/" },
      },
    };
  }),
  publishReviewRequest: mock(async () => {
    rbCallLog.push("publish");
    return {
      id: 77,
      summary: "Title",
      description: "Description",
      status: "pending",
      absolute_url: "https://reviews.example.com/r/77/",
      submitter: { username: "alice", title: "Alice" },
      links: {
        diffs: { href: "/api/review-requests/77/diffs/" },
        reviews: { href: "/api/review-requests/77/reviews/" },
      },
    };
  }),
};

mock.module("@cr/core", () =>
  makeCoreMock({
    remoteToProjectPath: (remoteUrl: string) => remoteUrl,
    getCurrentBranch: mock(async () => "feature/test"),
    getOriginRemoteUrl: mock(async () => "https://gitlab.example.com/group/project.git"),
    logger: {
      debug: () => {},
      trace: () => {},
      warn: () => {},
      error: () => {},
    },
    loadPrompt: mock(async () => "{mr_changes}"),
    createRuntimeGitLabClient: mock(() => ({
      branchExists: async () => true,
      listBranches: async () => ["main", "feature/test"],
      getDefaultBranch: async () => "main",
      compareBranches: async () => "diff",
      findExistingMergeRequest: async () => null,
      createMergeRequest: async () => "https://gitlab.example.com/mr/1",
      updateMergeRequest: async () => "https://gitlab.example.com/mr/1",
    })),
    createRuntimeLlmClient: createRuntimeLlmClientMock,
    createRuntimeReviewBoardClient: createRuntimeReviewBoardClientMock,
    loadWorkflowRuntime: mock(async () => ({
      gitlabUrl: "https://gitlab.example.com",
      gitlabKey: "gl-token",
      rbUrl: "https://reviews.example.com",
      rbToken: "rb-token",
      svnRepositoryUrl: "https://svn.example.com/repos/project",
      svnUsername: "",
      svnPassword: "",
      gitlabWebhookSecret: "",
      rbWebhookSecret: "",
      sslCertPath: "",
      sslKeyPath: "",
      sslCaPath: "",
      webhookConcurrency: 1,
      webhookQueueLimit: 50,
      webhookJobTimeoutMs: 600000,
      openaiApiUrl: "https://api.openai.com/v1",
      openaiApiKey: "openai-token",
      openaiModel: "gpt-4o",
      useCustomStreaming: false,
    })),
    isSvnWorkingCopy: isSvnWorkingCopyMock,
    getSvnDiff: getSvnDiffMock,
    getSvnRepoRootUrl: getSvnRepoRootUrlMock,
    getSvnWorkingCopyUrl: getSvnWorkingCopyUrlMock,
  })
);

const { runCreateReviewWorkflow } = await import(
  "../packages/workflows/src/createReviewWorkflow.js"
);

describe("createReview workflow", () => {
  beforeEach(() => {
    rbCallLog.length = 0;
    isSvnWorkingCopyMock.mockReset();
    isSvnWorkingCopyMock.mockImplementation(async () => true);
    getSvnDiffMock.mockReset();
    getSvnDiffMock.mockImplementation(async () => "Index: src/file.ts\n+change");
    rbClient.listRepositories.mockClear();
    rbClient.createReviewRequest.mockClear();
    rbClient.uploadReviewRequestDiff.mockClear();
    rbClient.updateReviewRequestDraft.mockClear();
    rbClient.publishReviewRequest.mockClear();
  });

  it("rejects Review Board create-review when the repo is not SVN", async () => {
    isSvnWorkingCopyMock.mockImplementationOnce(async () => false);

    const workflow = runCreateReviewWorkflow({
      repoPath: "/repo",
      repoRoot: "/root",
      mode: "ci",
      provider: "reviewboard",
      shouldProceed: true,
    });

    await expect(workflow.next()).rejects.toThrow("requires an SVN working copy");
  });

  it("creates and publishes a Review Board review request from SVN changes", async () => {
    const workflow = runCreateReviewWorkflow({
      repoPath: "/repo",
      repoRoot: "/root",
      mode: "ci",
      provider: "reviewboard",
      shouldProceed: true,
    });

    const firstStep = await workflow.next();
    expect(firstStep.done).toBe(false);
    expect(firstStep.value).toMatchObject({
      type: "draft_ready",
      draft: {
        provider: "reviewboard",
        sourceLabel: "https://svn.example.com/repos/project/trunk",
        title: "Title",
      },
    });

    const finalStep = await workflow.next();
    expect(finalStep.done).toBe(true);
    expect(finalStep.value).toMatchObject({
      provider: "reviewboard",
      entityType: "review_request",
      entityId: 77,
      url: "https://reviews.example.com/r/77/",
      action: "created",
    });

    expect(rbCallLog).toEqual(["create", "upload", "update", "publish"]);
    expect(rbClient.uploadReviewRequestDiff).toHaveBeenCalledWith(
      77,
      "Index: src/file.ts\n+change",
      "/trunk"
    );
  });
});
