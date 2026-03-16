import { describe, expect, it, mock } from "bun:test";
import { makeCoreMock, makeUiMock } from "./mocks.ts";

let lastQuestions: any[] = [];
let lastSavedConfig: any = null;
let mockConfig: any = {};
const printCommandHelpMock = mock(() => {});
const setupSpecsMock = mock(async () => []);
const setupRpiMock = mock(async () => []);
const runLiveTaskMock = mock(
  async (_title: string, run: (ui: { setResult: (title: string, body: string) => void }) => Promise<void>) => {
    await run({ setResult: () => {} });
  }
);

mock.module("@cr/tui", () =>
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
      stop: function () {
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
    printCommandHelp: printCommandHelpMock,
    printDivider: mock(() => {}),
    printEmptyLine: mock(() => {}),
    printWorkflowOutput: mock(() => {}),
    runLiveTask: runLiveTaskMock,
  })
);

mock.module("@cr/core", () =>
  makeCoreMock({
    loadCRConfig: mock(async () => mockConfig),
    saveCRConfig: mock(async (config: any) => {
      lastSavedConfig = config;
    }),
    initializeCRHome: mock(async () => {}),
    setupRpi: setupRpiMock,
    setupSpecs: setupSpecsMock,
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

const { runInitCommand } = await import("../packages/cli/src/commands/initCommand.js");

describe("initCommand - specialized setup flows", () => {
  it("should show init help with all setup subcommands", async () => {
    printCommandHelpMock.mockClear();
    runLiveTaskMock.mockClear();

    await runInitCommand(["--help"]);

    expect(printCommandHelpMock).toHaveBeenCalledTimes(1);
    expect(runLiveTaskMock).not.toHaveBeenCalled();
    const sections = printCommandHelpMock.mock.calls[0]?.[0] as Array<{
      title: string;
      lines: string[];
    }>;
    const options = sections.find((section) => section.title === "OPTIONS")?.lines.join("\n") ?? "";
    const examples =
      sections.find((section) => section.title === "EXAMPLES")?.lines.join("\n") ?? "";
    const modes =
      sections.find((section) => section.title === "SETUP MODES")?.lines.join("\n") ?? "";

    expect(options).toContain("--gitlab");
    expect(options).toContain("--github");
    expect(options).toContain("--reviewboard");
    expect(options).toContain("--subversion");
    expect(options).toContain("--webhook");
    expect(options).toContain("--sdd");
    expect(options).toContain("--rpi");
    expect(examples).toContain("cr init --rpi --path .");
    expect(modes).toContain("research-plan-implement");
  });

  it("should ask for both GitLab and Review Board webhook configs", async () => {
    mockConfig = { gitlabWebhookSecret: "old-secret" };
    lastQuestions = [];
    lastSavedConfig = null;
    runLiveTaskMock.mockClear();

    await runInitCommand(["--webhook"]);

    expect(runLiveTaskMock).toHaveBeenCalledTimes(1);
    expect(runLiveTaskMock.mock.calls[0]?.[0]).toBe("Webhook Configuration");
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

  it("should render GitHub setup inside the shared workflow shell", async () => {
    mockConfig = {};
    lastSavedConfig = null;
    runLiveTaskMock.mockClear();

    await runInitCommand(["--github"]);

    expect(runLiveTaskMock).toHaveBeenCalledTimes(1);
    expect(runLiveTaskMock.mock.calls[0]?.[0]).toBe("GitHub Configuration");
    expect(lastSavedConfig).toBeTruthy();
  });

  it("should support RPI setup inside the shared workflow shell", async () => {
    runLiveTaskMock.mockClear();
    setupRpiMock.mockClear();

    await runInitCommand(["--rpi"]);

    expect(runLiveTaskMock).toHaveBeenCalledTimes(1);
    expect(runLiveTaskMock.mock.calls[0]?.[0]).toBe("Research Plan Implement Setup");
    expect(setupRpiMock).toHaveBeenCalledWith(expect.any(String), "copilot");
  });
});
