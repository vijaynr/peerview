import { beforeEach, describe, expect, it, mock } from "bun:test";
import { makeCoreMock } from "./mocks.ts";

let capturedGitLabUrl = "";
let githubClientInitialized = false;

mock.module("@pv/core", () =>
  makeCoreMock({
    DEFAULT_REVIEW_AGENT_NAME: "general",
    getCurrentBranch: async () => "feature/demo",
    getOriginRemoteUrl: async () => "https://gitlab.example.com/group/project.git",
    remoteToGitHubRepoPath: () => "owner/repo",
    remoteToProjectPath: () => "group/project",
    loadPrompt: async (name: string) => {
      if (name === "review.txt") {
        return "STANDARD REVIEW\n{mr_changes}";
      }
      throw new Error(`unexpected prompt: ${name}`);
    },
    normalizeReviewAgentNames: (agentNames?: string[]) => {
      const values = (agentNames ?? ["general"]).map((name) => name.trim().toLowerCase());
      return Array.from(new Set(values.filter(Boolean)));
    },
    createRuntimeSvnClient: () => null,
    loadGitHubRepositoryGuidelines: async () => undefined,
    loadGitLabRepositoryGuidelines: async () => undefined,
    loadLocalRepositoryGuidelines: async () => undefined,
    loadSvnRepositoryGuidelines: async () => undefined,
    createRuntimeGitLabClient: (runtime: { gitlabUrl: string }) => {
      capturedGitLabUrl = runtime.gitlabUrl;
      return {
        getMergeRequest: async () => ({}),
        getMergeRequestChanges: async () => [],
        getMergeRequestCommits: async () => [],
        findOpenMergeRequestBySourceBranch: async () => ({ iid: 42 }),
        getMergeRequestInlineComments: async () => [],
      };
    },
    createRuntimeGitHubClient: () => {
      githubClientInitialized = true;
      return {
        getPullRequest: async () => ({ head: { sha: "abc123" } }),
        getPullRequestFiles: async () => [],
        getPullRequestCommits: async () => [],
        findOpenPullRequestByHead: async () => ({ number: 7 }),
        listReviewComments: async () => [],
      };
    },
    createRuntimeLlmClient: () => ({
      generate: async () => "review output",
    }),
    loadWorkflowRuntime: async () => ({
      gitlabUrl: "gitlab.example.com",
      gitlabKey: "gitlab-key",
      githubToken: "github-token",
      svnRepositoryUrl: "",
      svnUsername: "",
      svnPassword: "",
      rbUrl: "https://reviews.example.com",
      rbToken: "rb-token",
      webhookConcurrency: 1,
      webhookQueueLimit: 50,
      webhookJobTimeoutMs: 600000,
      openaiApiUrl: "https://api.example.com/v1",
      openaiApiKey: "openai-key",
      openaiModel: "gpt-4o",
      useCustomStreaming: false,
      defaultReviewAgents: ["general"],
    }),
    assert: (value: unknown, message: string) => {
      if (!value) {
        throw new Error(message);
      }
      return value;
    },
    runWorkflow: async ({ initialState, steps, routes, start }: any) => {
      const state = { ...initialState };
      let current = start;
      while (current && current !== "end") {
        const updates = await steps[current](state);
        Object.assign(state, updates);
        const route = routes[current];
        current = typeof route === "function" ? route(state) : route;
      }
      return state;
    },
  })
);

const { runReviewWorkflow } = await import("../packages/workflows/src/reviewWorkflow.ts");

describe("review workflow url handling", () => {
  beforeEach(() => {
    capturedGitLabUrl = "";
    githubClientInitialized = false;
  });

  it("derives the GitLab API host from an explicit merge request URL", async () => {
    const result = await runReviewWorkflow({
      repoPath: ".",
      repoRoot: ".",
      mode: "ci",
      workflow: "review",
      local: false,
      state: "opened",
      provider: "gitlab",
      url: "https://gitlab.custom.example/group/project/-/merge_requests/42",
      mrIid: 42,
      agentNames: ["general"],
      agentMode: "single",
    });

    expect(capturedGitLabUrl).toBe("https://gitlab.custom.example");
    expect(result).toMatchObject({
      gitlabUrl: "https://gitlab.custom.example",
      projectPath: "group/project",
      mrIid: 42,
    });
  });

  it("uses the GitHub client for explicit pull request URLs", async () => {
    const result = await runReviewWorkflow({
      repoPath: ".",
      repoRoot: ".",
      mode: "ci",
      workflow: "review",
      local: false,
      state: "opened",
      provider: "github",
      url: "https://github.com/owner/repo/pull/7",
      prNumber: 7,
      agentNames: ["general"],
      agentMode: "single",
    });

    expect(githubClientInitialized).toBe(true);
    expect(result).toMatchObject({
      githubUrl: "https://github.com",
      repoPath: "owner/repo",
      prNumber: 7,
    });
  });
});
