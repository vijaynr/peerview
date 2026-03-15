import { describe, expect, it, mock } from "bun:test";
import { runInitCommand } from "../packages/cli/src/commands/initCommand.js";
import { makeCoreMock, makeUiMock } from "./mocks.ts";

let lastQuestions: any[] = [];
let lastSavedConfig: any = null;
let mockConfig: any = {};

mock.module("@cr/ui", () =>
  makeUiMock({
    promptWithFrame: mock(async (questions: any) => {
      lastQuestions = questions;
      const answers: any = {};
      for (const q of questions) {
        if (q.name === "gitlabWebhookSecret") answers[q.name] = "new-secret";
        else if (q.name === "rbUrl") answers[q.name] = "https://new-rb.com";
        else if (q.name === "rbToken") answers[q.name] = "new-token";
        else if (q.name === "rbWebhookSecret") answers[q.name] = "new-rb-secret";
        else if (q.name === "svnRepositoryUrl")
          answers[q.name] = "https://svn.example.com/repos/project";
        else if (q.name === "svnUsername") answers[q.name] = "svn-user";
        else if (q.name === "svnPassword") answers[q.name] = "svn-pass";
        else if (q.name === "webhookConcurrency") answers[q.name] = 10;
        else answers[q.name] = q.initial;
      }
      return answers;
    }),
    createSpinner: () => ({
      start: function () {
        return this;
      },
      stopAndPersist: function () {
        return this;
      },
      fail: function () {
        return this;
      },
    }),
    printError: mock(() => {}),
    printSuccess: mock(() => {}),
    printWarning: mock(() => {}),
    printInfo: mock(() => {}),
    printDivider: mock(() => {}),
    printEmptyLine: mock(() => {}),
    printWorkflowOutput: mock(() => {}),
  })
);

mock.module("@cr/core", () =>
  makeCoreMock({
    loadCRConfig: mock(async () => mockConfig),
    saveCRConfig: mock(async (config: any) => {
      lastSavedConfig = config;
    }),
    initializeCRHome: mock(async () => {}),
    repoRootFromModule: () => "/mock/root",
    CR_CONF_PATH: "/mock/cr.conf",
    defaultConfig: {
      openaiApiUrl: "https://api.openai.com/v1",
      openaiModel: "gpt-4",
      gitlabUrl: "https://gitlab.com",
      rbUrl: "https://reviews.reviewboard.org",
    },
  })
);

describe("initCommand - specialized setup flows", () => {
  it("should ask for both GitLab and Review Board webhook configs", async () => {
    mockConfig = { gitlabWebhookSecret: "old-secret" };
    lastQuestions = [];
    lastSavedConfig = null;

    await runInitCommand(["--webhook"]);

    expect(lastQuestions.some((q) => q.name === "gitlabWebhookSecret")).toBe(true);
    expect(lastQuestions.some((q) => q.name === "rbUrl")).toBe(true);
    expect(lastQuestions.some((q) => q.name === "rbToken")).toBe(true);
    expect(lastQuestions.some((q) => q.name === "rbWebhookSecret")).toBe(true);
    expect(lastSavedConfig.gitlabWebhookSecret).toBe("new-secret");
    expect(lastSavedConfig.rbUrl).toBe("https://new-rb.com");
    expect(lastSavedConfig.rbToken).toBe("new-token");
    expect(lastSavedConfig.rbWebhookSecret).toBe("new-rb-secret");
  });

  it("should preserve existing config fields", async () => {
    mockConfig = {
      openaiApiKey: "existing-key",
      gitlabKey: "existing-gitlab-key",
    };
    lastSavedConfig = null;

    await runInitCommand(["--webhook"]);

    expect(lastSavedConfig.openaiApiKey).toBe("existing-key");
    expect(lastSavedConfig.gitlabKey).toBe("existing-gitlab-key");
  });

  it("should support subversion setup", async () => {
    mockConfig = {
      openaiApiUrl: "https://api.openai.com/v1",
      openaiModel: "gpt-4",
      gitlabUrl: "https://gitlab.com",
    };
    lastQuestions = [];
    lastSavedConfig = null;

    await runInitCommand(["--subversion"]);

    expect(lastQuestions.some((q) => q.name === "svnRepositoryUrl")).toBe(true);
    expect(lastQuestions.some((q) => q.name === "svnUsername")).toBe(true);
    expect(lastQuestions.some((q) => q.name === "svnPassword")).toBe(true);
    expect(lastSavedConfig.svnRepositoryUrl).toBe("https://svn.example.com/repos/project");
    expect(lastSavedConfig.svnUsername).toBe("svn-user");
    expect(lastSavedConfig.svnPassword).toBe("svn-pass");
  });
});
