import { afterEach, describe, expect, it, mock } from "bun:test";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { startServer } from "../packages/server/src/server.js";
import { makeCoreMock, makeWorkflowsMock } from "./mocks.ts";

const loadCRConfigMock = mock(async () => ({
  openaiApiUrl: "https://api.example.com/v1",
  openaiApiKey: "openai-key",
  openaiModel: "gpt-4o",
  useCustomStreaming: false,
  gitlabUrl: "https://gitlab.example.com",
  gitlabKey: "gitlab-key",
  githubToken: "github-token",
  rbUrl: "https://reviews.example.com",
  rbToken: "rb-token",
  defaultReviewAgents: ["general"],
}));
const saveCRConfigMock = mock(async (_config: unknown) => {});
const listMergeRequestsMock = mock(async () => [{ iid: 7, title: "MR 7" }]);
const getMergeRequestMock = mock(async () => ({ iid: 7, title: "MR 7", state: "opened" }));
const getMergeRequestChangesMock = mock(async () => [{ old_path: "a.ts", new_path: "a.ts" }]);
const getMergeRequestCommitsMock = mock(async () => [{ id: "abc123" }]);
const addMergeRequestCommentMock = mock(async () => "https://gitlab.example.com/mr/7#note_1");
const listGitHubPullRequestsMock = mock(async () => [{ number: 12, title: "PR 12" }]);
const getGitHubPullRequestMock = mock(async () => ({ number: 12, title: "PR 12", state: "open" }));
const getGitHubPullRequestFilesMock = mock(async () => [
  { filename: "src/app.ts", status: "modified" },
]);
const getGitHubPullRequestCommitsMock = mock(async () => [{ sha: "def456" }]);
const addGitHubPullRequestCommentMock = mock(
  async () => "https://github.com/org/repo/pull/12#issuecomment-1"
);
const listRepositoriesMock = mock(async () => [{ id: 9, name: "demo-repo" }]);
const listReviewRequestsMock = mock(async () => [{ id: 42, summary: "RR 42" }]);
const getReviewRequestMock = mock(async () => ({ id: 42, summary: "RR 42" }));
const getLatestDiffSetMock = mock(async () => ({ id: 77 }));
const getFileDiffsMock = mock(async () => [{ id: 1001, sourceFile: "src/app.ts" }]);
const getFileDiffDataMock = mock(async () => ({ id: 1001, diff: "@@ -1 +1 @@" }));
const createReviewRequestMock = mock(async () => ({ id: 43 }));
const updateReviewRequestDraftMock = mock(async () => ({ id: 42, summary: "Updated RR" }));
const uploadReviewRequestDiffMock = mock(async () => ({ id: 88 }));
const publishReviewRequestMock = mock(async () => ({ id: 42, status: "submitted" }));
const createReviewMock = mock(async () => ({ id: 300 }));
const addDiffCommentMock = mock(async () => {});
const publishReviewMock = mock(async () => {});
const getOriginRemoteUrlMock = mock(async () => "https://gitlab.example.com/group/project.git");
const remoteToProjectPathMock = mock(() => "group/project");
const remoteToGitHubRepoPathMock = mock(() => "org/repo");
const listBundledReviewAgentNamesMock = mock(() => ["general", "security", "clean-code"]);
const runReviewWorkflowMock = mock(async () => ({
  output: "Generated review",
  contextLabel: "MR !7 (group/project)",
  overallSummary: "Overall review summary",
  inlineComments: [{ filePath: "src/app.ts", line: 12, positionType: "new", comment: "Tighten this branch." }],
  selectedAgents: ["general", "security"],
  aggregated: true,
  agentResults: [{ name: "general", output: "Agent output" }],
  mrIid: 7,
  projectPath: "group/project",
  gitlabUrl: "https://gitlab.example.com",
}));
const runReviewSummarizeWorkflowMock = mock(async () => ({
  output: "Summary output",
  contextLabel: "MR !7 (group/project)",
  inlineComments: [],
  selectedAgents: [],
  aggregated: false,
}));
const runReviewChatWorkflowMock = mock(async () => ({
  contextLabel: "MR !7 (group/project)",
  mrContent: "{}",
  mrChanges: "[]",
  mrCommits: "[]",
  summary: "Chat context summary",
}));
const answerReviewChatQuestionMock = mock(async () => ({
  answer: "This change looks safe.",
  history: [{ question: "Any risk?", answer: "This change looks safe." }],
}));
const maybePostReviewCommentMock = mock(async () => ({
  summaryNoteId: "note-9",
  inlineNoteIds: ["inline-1"],
}));

mock.module("@cr/workflows", () =>
  makeWorkflowsMock({
    runReviewWorkflow: runReviewWorkflowMock,
    runReviewSummarizeWorkflow: runReviewSummarizeWorkflowMock,
    runReviewChatWorkflow: runReviewChatWorkflowMock,
    answerReviewChatQuestion: answerReviewChatQuestionMock,
    maybePostReviewComment: maybePostReviewCommentMock,
  })
);

mock.module("@cr/core", () =>
  makeCoreMock({
    loadCRConfig: loadCRConfigMock,
    saveCRConfig: saveCRConfigMock,
    loadWorkflowRuntime: async () => ({
      gitlabUrl: "https://gitlab.example.com",
      gitlabKey: "gitlab-key",
      rbUrl: "https://reviews.example.com",
      rbToken: "rb-token",
      webhookConcurrency: 1,
      webhookQueueLimit: 10,
      webhookJobTimeoutMs: 1000,
      defaultReviewAgents: ["general"],
    }),
    getOriginRemoteUrl: getOriginRemoteUrlMock,
    remoteToProjectPath: remoteToProjectPathMock,
    remoteToGitHubRepoPath: remoteToGitHubRepoPathMock,
    listBundledReviewAgentNames: listBundledReviewAgentNamesMock,
    listMergeRequests: listMergeRequestsMock,
    getMergeRequest: getMergeRequestMock,
    getMergeRequestChanges: getMergeRequestChangesMock,
    getMergeRequestCommits: getMergeRequestCommitsMock,
    addMergeRequestComment: addMergeRequestCommentMock,
    listGitHubPullRequests: listGitHubPullRequestsMock,
    getGitHubPullRequest: getGitHubPullRequestMock,
    getGitHubPullRequestFiles: getGitHubPullRequestFilesMock,
    getGitHubPullRequestCommits: getGitHubPullRequestCommitsMock,
    addGitHubPullRequestComment: addGitHubPullRequestCommentMock,
    listRepositories: listRepositoriesMock,
    listReviewRequests: listReviewRequestsMock,
    getReviewRequest: getReviewRequestMock,
    getLatestDiffSet: getLatestDiffSetMock,
    getFileDiffs: getFileDiffsMock,
    getFileDiffData: getFileDiffDataMock,
    createReviewRequest: createReviewRequestMock,
    updateReviewRequestDraft: updateReviewRequestDraftMock,
    uploadReviewRequestDiff: uploadReviewRequestDiffMock,
    publishReviewRequest: publishReviewRequestMock,
    createReview: createReviewMock,
    addDiffComment: addDiffCommentMock,
    publishReview: publishReviewMock,
  })
);

const servers: Array<{ close: () => void }> = [];

afterEach(() => {
  while (servers.length > 0) {
    servers.pop()?.close();
  }
  loadCRConfigMock.mockClear();
  saveCRConfigMock.mockClear();
  listMergeRequestsMock.mockClear();
  getMergeRequestMock.mockClear();
  getMergeRequestChangesMock.mockClear();
  getMergeRequestCommitsMock.mockClear();
  addMergeRequestCommentMock.mockClear();
  listGitHubPullRequestsMock.mockClear();
  getGitHubPullRequestMock.mockClear();
  getGitHubPullRequestFilesMock.mockClear();
  getGitHubPullRequestCommitsMock.mockClear();
  addGitHubPullRequestCommentMock.mockClear();
  listRepositoriesMock.mockClear();
  listReviewRequestsMock.mockClear();
  getReviewRequestMock.mockClear();
  getLatestDiffSetMock.mockClear();
  getFileDiffsMock.mockClear();
  getFileDiffDataMock.mockClear();
  createReviewRequestMock.mockClear();
  updateReviewRequestDraftMock.mockClear();
  uploadReviewRequestDiffMock.mockClear();
  publishReviewRequestMock.mockClear();
  createReviewMock.mockClear();
  addDiffCommentMock.mockClear();
  publishReviewMock.mockClear();
  getOriginRemoteUrlMock.mockClear();
  remoteToProjectPathMock.mockClear();
  remoteToGitHubRepoPathMock.mockClear();
  listBundledReviewAgentNamesMock.mockClear();
  runReviewWorkflowMock.mockClear();
  runReviewSummarizeWorkflowMock.mockClear();
  runReviewChatWorkflowMock.mockClear();
  answerReviewChatQuestionMock.mockClear();
  maybePostReviewCommentMock.mockClear();
});

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

async function startApiServer() {
  const port = await findAvailablePort();
  const server = await startServer(port, { enableWeb: false, enableWebhook: false });
  servers.push(server);
  return port;
}

describe("API routes", () => {
  it("lists the supported operations", async () => {
    const port = await startApiServer();

    const response = await fetch(`http://localhost:${port}/api/operations`);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.groups.map((group: { group: string }) => group.group)).toEqual([
      "config",
      "review",
      "gitlab",
      "github",
      "reviewboard",
      "test",
    ]);
  });

  it("gets and updates config", async () => {
    const port = await startApiServer();

    const getResponse = await fetch(`http://localhost:${port}/api/config`);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toMatchObject({
      gitlabUrl: "https://gitlab.example.com",
      githubToken: "github-token",
    });

    const putResponse = await fetch(`http://localhost:${port}/api/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openaiModel: "gpt-5",
        gitlabKey: "new-gitlab-key",
      }),
    });

    expect(putResponse.status).toBe(200);
    expect(saveCRConfigMock).toHaveBeenCalledTimes(1);
    expect(saveCRConfigMock.mock.calls[0]?.[0]).toMatchObject({
      openaiModel: "gpt-5",
      gitlabKey: "new-gitlab-key",
      gitlabUrl: "https://gitlab.example.com",
    });
  });

  it("serves GitLab merge request APIs", async () => {
    const port = await startApiServer();

    const [listResponse, detailResponse, diffResponse, commitResponse, commentResponse] =
      await Promise.all([
        fetch(`http://localhost:${port}/api/gitlab/merge-requests`),
        fetch(`http://localhost:${port}/api/gitlab/merge-requests/7`),
        fetch(`http://localhost:${port}/api/gitlab/merge-requests/7/diffs`),
        fetch(`http://localhost:${port}/api/gitlab/merge-requests/7/commits`),
        fetch(`http://localhost:${port}/api/gitlab/merge-requests/7/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: "Looks good" }),
        }),
      ]);

    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject([{ iid: 7, title: "MR 7" }]);
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({ iid: 7 });
    expect(diffResponse.status).toBe(200);
    expect(await diffResponse.json()).toMatchObject([{ new_path: "a.ts" }]);
    expect(commitResponse.status).toBe(200);
    expect(await commitResponse.json()).toMatchObject([{ id: "abc123" }]);
    expect(commentResponse.status).toBe(200);
    expect(await commentResponse.json()).toMatchObject({
      url: "https://gitlab.example.com/mr/7#note_1",
    });
    expect(remoteToProjectPathMock).toHaveBeenCalled();
  });

  it("serves GitHub pull request APIs", async () => {
    const port = await startApiServer();

    const [listResponse, detailResponse, diffResponse, commitResponse, commentResponse] =
      await Promise.all([
        fetch(`http://localhost:${port}/api/github/pull-requests`),
        fetch(`http://localhost:${port}/api/github/pull-requests/12`),
        fetch(`http://localhost:${port}/api/github/pull-requests/12/diffs`),
        fetch(`http://localhost:${port}/api/github/pull-requests/12/commits`),
        fetch(`http://localhost:${port}/api/github/pull-requests/12/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: "Please update this" }),
        }),
      ]);

    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject([{ number: 12, title: "PR 12" }]);
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({ number: 12 });
    expect(diffResponse.status).toBe(200);
    expect(await diffResponse.json()).toMatchObject([{ filename: "src/app.ts" }]);
    expect(commitResponse.status).toBe(200);
    expect(await commitResponse.json()).toMatchObject([{ sha: "def456" }]);
    expect(commentResponse.status).toBe(200);
    expect(await commentResponse.json()).toMatchObject({
      url: "https://github.com/org/repo/pull/12#issuecomment-1",
    });
    expect(remoteToGitHubRepoPathMock).toHaveBeenCalled();
  });

  it("filters merged GitHub pull requests correctly", async () => {
    listGitHubPullRequestsMock.mockImplementationOnce(async () => [
      { number: 12, title: "PR 12", state: "closed", merged_at: "2025-01-01T00:00:00Z" },
      { number: 13, title: "PR 13", state: "closed", merged_at: null, merged: false },
    ]);
    const port = await startApiServer();

    const response = await fetch(`http://localhost:${port}/api/github/pull-requests?state=merged`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ number: 12 }]);
  });

  it("serves review workflow APIs", async () => {
    const port = await startApiServer();

    const [
      agentsResponse,
      reviewResponse,
      summaryResponse,
      chatContextResponse,
      chatAnswerResponse,
      postResponse,
    ] = await Promise.all([
      fetch(`http://localhost:${port}/api/review/agents`),
      fetch(`http://localhost:${port}/api/review/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "gitlab",
          targetId: 7,
          agentNames: ["general", "security"],
          inlineComments: true,
        }),
      }),
      fetch(`http://localhost:${port}/api/review/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gitlab", targetId: 7 }),
      }),
      fetch(`http://localhost:${port}/api/review/chat/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gitlab", targetId: 7 }),
      }),
      fetch(`http://localhost:${port}/api/review/chat/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            contextLabel: "MR !7 (group/project)",
            mrContent: "{}",
            mrChanges: "[]",
            mrCommits: "[]",
            summary: "Chat context summary",
          },
          question: "Any risk?",
          history: [],
        }),
      }),
      fetch(`http://localhost:${port}/api/review/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "gitlab",
          result: {
            output: "Generated review",
            contextLabel: "MR !7 (group/project)",
            inlineComments: [],
            selectedAgents: ["general"],
            aggregated: false,
            mrIid: 7,
            projectPath: "group/project",
            gitlabUrl: "https://gitlab.example.com",
          },
        }),
      }),
    ]);

    expect(agentsResponse.status).toBe(200);
    const agentsJson = await agentsResponse.json();
    expect(agentsJson.options).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "general", selected: true })])
    );

    expect(reviewResponse.status).toBe(200);
    expect(await reviewResponse.json()).toMatchObject({
      result: { contextLabel: "MR !7 (group/project)" },
      warnings: ["Multi-agent review does not support inline comments yet. This run will produce a summary comment only."],
    });

    expect(summaryResponse.status).toBe(200);
    expect(await summaryResponse.json()).toMatchObject({
      result: { output: "Summary output" },
    });

    expect(chatContextResponse.status).toBe(200);
    expect(await chatContextResponse.json()).toMatchObject({
      context: { summary: "Chat context summary" },
    });

    expect(chatAnswerResponse.status).toBe(200);
    expect(await chatAnswerResponse.json()).toMatchObject({
      answer: "This change looks safe.",
    });

    expect(postResponse.status).toBe(200);
    expect(await postResponse.json()).toMatchObject({
      posted: { summaryNoteId: "note-9", inlineNoteIds: ["inline-1"] },
    });
  });

  it("serves Review Board APIs", async () => {
    const port = await startApiServer();

    const [reposResponse, listResponse, detailResponse, diffsResponse, fileResponse] =
      await Promise.all([
        fetch(`http://localhost:${port}/api/reviewboard/repositories`),
        fetch(`http://localhost:${port}/api/reviewboard/review-requests`),
        fetch(`http://localhost:${port}/api/reviewboard/review-requests/42`),
        fetch(`http://localhost:${port}/api/reviewboard/review-requests/42/diffs`),
        fetch(`http://localhost:${port}/api/reviewboard/review-requests/42/diffs/77/files/1001`),
      ]);

    expect(reposResponse.status).toBe(200);
    expect(await reposResponse.json()).toMatchObject([{ id: 9, name: "demo-repo" }]);
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject([{ id: 42, summary: "RR 42" }]);
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({ id: 42 });
    expect(diffsResponse.status).toBe(200);
    expect(await diffsResponse.json()).toMatchObject({
      diffSet: { id: 77 },
      files: [{ id: 1001 }],
    });
    expect(fileResponse.status).toBe(200);
    expect(await fileResponse.json()).toMatchObject({ id: 1001 });
  });

  it("creates and publishes Review Board resources", async () => {
    const port = await startApiServer();

    const [
      createRequestResponse,
      updateRequestResponse,
      uploadDiffResponse,
      publishRequestResponse,
    ] = await Promise.all([
      fetch(`http://localhost:${port}/api/reviewboard/review-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: 9 }),
      }),
      fetch(`http://localhost:${port}/api/reviewboard/review-requests/42`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "Updated RR" }),
      }),
      fetch(`http://localhost:${port}/api/reviewboard/review-requests/42/diffs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diff: "Index: src/app.ts\n+change" }),
      }),
      fetch(`http://localhost:${port}/api/reviewboard/review-requests/42/publish`, {
        method: "POST",
      }),
    ]);

    expect(createRequestResponse.status).toBe(200);
    expect(await createRequestResponse.json()).toMatchObject({ id: 43 });
    expect(updateRequestResponse.status).toBe(200);
    expect(await updateRequestResponse.json()).toMatchObject({ summary: "Updated RR" });
    expect(uploadDiffResponse.status).toBe(200);
    expect(await uploadDiffResponse.json()).toMatchObject({ id: 88 });
    expect(publishRequestResponse.status).toBe(200);
    expect(await publishRequestResponse.json()).toMatchObject({ status: "submitted" });
  });

  it("creates reviews and diff comments for Review Board", async () => {
    const port = await startApiServer();

    const createReviewResponse = await fetch(
      `http://localhost:${port}/api/reviewboard/review-requests/42/reviews`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyTop: "Summary review" }),
      }
    );

    expect(createReviewResponse.status).toBe(200);
    expect(await createReviewResponse.json()).toMatchObject({ id: 300 });

    const addCommentResponse = await fetch(
      `http://localhost:${port}/api/reviewboard/review-requests/42/reviews/300/diff-comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileDiffId: 1001,
          firstLine: 10,
          numLines: 1,
          text: "Please update this line",
        }),
      }
    );
    expect(addCommentResponse.status).toBe(200);
    expect(addDiffCommentMock).toHaveBeenCalledTimes(1);

    const publishReviewResponse = await fetch(
      `http://localhost:${port}/api/reviewboard/review-requests/42/reviews/300/publish`,
      {
        method: "POST",
      }
    );
    expect(publishReviewResponse.status).toBe(200);
    expect(publishReviewMock).toHaveBeenCalledTimes(1);
  });
});
