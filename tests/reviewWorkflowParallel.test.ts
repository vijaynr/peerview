import { beforeEach, describe, expect, it, mock } from "bun:test";
import { makeCoreMock } from "./mocks.ts";

let startedAgents: string[] = [];
let aggregateCallCount = 0;
let agentDeferreds = new Map<
  string,
  { resolve: (value: string) => void; reject: (error: Error) => void; promise: Promise<string> }
>();

function createDeferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

function getDeferred(agentName: string) {
  const existing = agentDeferreds.get(agentName);
  if (existing) {
    return existing;
  }
  const created = createDeferred();
  agentDeferreds.set(agentName, created);
  return created;
}

async function waitForAgentStarts(): Promise<void> {
  for (let attempt = 0; attempt < 10 && startedAgents.length < 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

mock.module("@pv/core", () =>
  makeCoreMock({
    DEFAULT_REVIEW_AGENT_NAME: "general",
    getCurrentBranch: async () => "feature/demo",
    getOriginRemoteUrl: async () => "https://gitlab.example.com/group/project.git",
    remoteToProjectPath: () => "group/project",
    loadPrompt: async (name: string) => {
      if (name === "review.txt") {
        return "STANDARD REVIEW\n{mr_changes}";
      }
      if (name === "review-aggregate.txt") {
        return "AGGREGATE\n{context_label}\n{agent_outputs}\n{failed_agents}";
      }
      throw new Error(`unexpected prompt: ${name}`);
    },
    loadReviewAgentPrompt: async (name: string) => `AGENT:${name}\n{mr_changes}`,
    normalizeReviewAgentNames: (agentNames?: string[]) => {
      const values = (agentNames ?? ["general"]).map((name) => name.trim().toLowerCase());
      return Array.from(new Set(values.filter(Boolean)));
    },
    createRuntimeSvnClient: () => null,
    loadGitLabRepositoryGuidelines: async () => undefined,
    loadLocalRepositoryGuidelines: async () => undefined,
    loadSvnRepositoryGuidelines: async () => undefined,
    createRuntimeGitLabClient: () => ({
      getMergeRequest: async () => ({}),
      getMergeRequestChanges: async () => [],
      getMergeRequestCommits: async () => [],
      findOpenMergeRequestBySourceBranch: async () => ({ iid: 1 }),
      getMergeRequestInlineComments: async () => [],
    }),
    createRuntimeLlmClient: () => ({
      generate: async (prompt: string) => {
        if (prompt.startsWith("AGENT:")) {
          const firstLine = prompt.split("\n", 1)[0];
          const agentName = firstLine.slice("AGENT:".length);
          startedAgents.push(agentName);
          return getDeferred(agentName).promise;
        }
        if (prompt.startsWith("AGGREGATE")) {
          aggregateCallCount += 1;
          return "aggregated review";
        }
        return "single review";
      },
    }),
    loadWorkflowRuntime: async () => ({
      gitlabUrl: "https://gitlab.example.com",
      gitlabKey: "gitlab-key",
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

describe("parallel review workflow", () => {
  beforeEach(() => {
    startedAgents = [];
    aggregateCallCount = 0;
    agentDeferreds = new Map();
  });

  it("starts all selected review agents before aggregation", async () => {
    const reviewPromise = runReviewWorkflow({
      repoPath: ".",
      repoRoot: ".",
      mode: "ci",
      workflow: "review",
      local: true,
      state: "opened",
      stdinDiff: "diff --git a/a.ts b/a.ts",
      agentNames: ["security", "clean-code"],
      agentMode: "multi",
    });

    await waitForAgentStarts();

    expect(startedAgents.sort()).toEqual(["clean-code", "security"]);
    expect(aggregateCallCount).toBe(0);

    getDeferred("security").resolve("security finding");
    getDeferred("clean-code").resolve("clean code finding");

    const result = await reviewPromise;
    expect(aggregateCallCount).toBe(1);
    expect(result).toMatchObject({
      output: "aggregated review",
      aggregated: true,
      selectedAgents: ["security", "clean-code"],
    });
    expect(result.agentResults).toHaveLength(2);
  });

  it("aggregates successful agents when one agent fails", async () => {
    const reviewPromise = runReviewWorkflow({
      repoPath: ".",
      repoRoot: ".",
      mode: "ci",
      workflow: "review",
      local: true,
      state: "opened",
      stdinDiff: "diff --git a/a.ts b/a.ts",
      agentNames: ["security", "clean-code"],
      agentMode: "multi",
    });

    await waitForAgentStarts();

    getDeferred("security").resolve("security finding");
    getDeferred("clean-code").reject(new Error("agent boom"));

    const result = await reviewPromise;
    expect(result.output).toBe("aggregated review");
    expect(result.agentResults).toEqual([
      { name: "security", output: "security finding" },
      { name: "clean-code", output: "", failed: true, error: "agent boom" },
    ]);
  });
});
