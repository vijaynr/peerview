import { describe, expect, it, mock } from "bun:test";
import { makeCoreMock, makeUiMock, makeWorkflowsMock } from "./mocks.ts";

const promptWithFrameMock = mock(async () => ({}));
const setResultMock = mock(() => {});
const printReviewSummaryMock = mock(() => {});
const runInteractiveReviewSessionMock = mock(async function* () {
  yield {
    type: "select_review_target",
    provider: "gitlab",
    message: "Select merge request (type to search)",
    options: [{ title: "!7 [opened] Demo", value: 7 }],
  };
  return {
    action: "cancelled",
    message: "Merge request selection cancelled.",
  };
});
const runLiveTaskMock = mock(async (_title: string, run: (ui: any) => Promise<void>) => {
  await run({
    setResult: setResultMock,
  });
});

mock.module("@cr/tui", () =>
  makeUiMock({
    abortOnCancel: { onCancel: () => false },
    askForOptionalFeedback: mock(async () => null),
    promptWithFrame: promptWithFrameMock,
    createWorkflowStatusController: () => ({
      status: { info: () => {}, success: () => {}, warning: () => {}, error: () => {} },
      events: { emit: () => {} },
      stop: () => {},
      close: () => {},
    }),
    runLiveTask: runLiveTaskMock,
    runLiveChatLoop: mock(async () => {}),
    printAlert: mock(() => {}),
    printCommandHelp: mock(() => {}),
    printReviewComment: mock(() => {}),
    printReviewSummary: printReviewSummaryMock,
  })
);

mock.module("@cr/core", () =>
  makeCoreMock({
    envOrConfig: (_key: string, value: string | undefined, fallback: string) => value || fallback,
    loadCRConfig: mock(async () => ({})),
    repoRootFromModule: () => "/mock/root",
    getOriginRemoteUrl: mock(async () => "https://gitlab.example.com/group/project.git"),
  })
);

mock.module("@cr/workflows", () =>
  makeWorkflowsMock({
    maybePostReviewComment: mock(async () => null),
    maybePostReviewBoardComment: mock(async () => null),
    runReviewWorkflow: mock(async () => ({})),
    answerReviewChatQuestion: mock(async () => ({ answer: "", history: [] })),
    runInteractiveReviewSession: runInteractiveReviewSessionMock,
  })
);

mock.module("../packages/cli/src/cliHelpers.js", () => ({
  getFlag(args: string[], key: string, fallback: string, short?: string): string {
    const prefixed = `--${key}=`;
    const pair = args.find((a) => a.startsWith(prefixed));
    if (pair) {
      return pair.slice(prefixed.length);
    }

    const idx = args.indexOf(`--${key}`);
    if (idx >= 0 && args[idx + 1]) {
      return args[idx + 1];
    }

    if (short) {
      const shortIdx = args.indexOf(short);
      if (shortIdx >= 0 && args[shortIdx + 1]) {
        return args[shortIdx + 1];
      }
    }

    return fallback;
  },
  hasFlag(args: string[], key: string): boolean {
    return args.includes(`--${key}`);
  },
  readStdinDiff: mock(async () => undefined),
  getWorkflowHeadingAndDescription(workflow: string, local: boolean, provider?: string) {
    const isRB = provider === "reviewboard";
    const isGitHub = provider === "github";
    const itemType = isRB
      ? "Review Request (Review Board)"
      : isGitHub
        ? "Pull Request"
        : "Merge Request";

    if (workflow === "chat") {
      return {
        heading: "Code Review Chat",
        description: `Interactive Q&A over ${itemType.toLowerCase()} context.`,
      };
    }

    if (workflow === "summarize") {
      return {
        heading: local ? "Local Changes Summary" : `${itemType} Summary`,
        description: local
          ? "Generate a concise summary of local diff changes."
          : `Generate a concise summary for the selected ${itemType.toLowerCase()}.`,
      };
    }

    return {
      heading: local ? "Local Code Review" : `${itemType} Review`,
      description: local
        ? "Review local diff changes and generate feedback."
        : `Review the selected ${itemType.toLowerCase()} and generate feedback.`,
    };
  },
  getWorkflowResultTitle(workflow: string, local: boolean, provider?: string): string {
    const isRB = provider === "reviewboard";
    const isGitHub = provider === "github";
    const itemType = isRB
      ? "Review Request (Review Board)"
      : isGitHub
        ? "Pull Request"
        : "Merge Request";

    if (workflow === "chat") {
      return "Workflow: Code Review Chat";
    }
    if (workflow === "summarize") {
      return local ? "Workflow: Local Changes Summary" : `Workflow: ${itemType} Summary`;
    }
    return "Workflow: Code Review";
  },
}));

const { runReviewCommand } = await import("../packages/cli/src/commands/reviewCommand.js");

describe("review command cancellation", () => {
  it("treats escape during merge request selection as workflow cancellation", async () => {
    await runReviewCommand([]);

    expect(promptWithFrameMock).toHaveBeenCalledTimes(1);
    expect(promptWithFrameMock.mock.calls[0]?.[1]).toEqual({ onCancel: expect.any(Function) });
    expect(promptWithFrameMock.mock.calls[0]?.[1].onCancel()).toBe(false);
    expect(setResultMock).toHaveBeenCalledWith(
      expect.any(String),
      "Merge request selection cancelled."
    );
  });

  it("defaults review runs to GitLab without provider flags", async () => {
    runInteractiveReviewSessionMock.mockClear();

    await runReviewCommand([]);

    expect(runInteractiveReviewSessionMock).toHaveBeenCalledTimes(1);
    expect(runInteractiveReviewSessionMock.mock.calls[0]?.[0]).toMatchObject({
      provider: "gitlab",
    });
  });

  it("passes the GitHub provider through when requested", async () => {
    runInteractiveReviewSessionMock.mockClear();

    await runReviewCommand(["--github"]);

    expect(runInteractiveReviewSessionMock).toHaveBeenCalledTimes(1);
    expect(runInteractiveReviewSessionMock.mock.calls[0]?.[0]).toMatchObject({
      provider: "github",
    });
  });

  it("prints a workflow result footer for summarize runs", async () => {
    runInteractiveReviewSessionMock.mockImplementationOnce(async function* () {
      return {
        action: "summary",
        result: {
          contextLabel: "MR !12 (demo)",
          output: "Summary output",
          inlineComments: [],
          selectedAgents: [],
          aggregated: false,
        },
      };
    });

    await runReviewCommand(["--workflow", "summarize"]);

    expect(printReviewSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contextLabel: "MR !12 (demo)",
      })
    );
    expect(setResultMock).toHaveBeenCalledWith(
      expect.stringContaining("Summary"),
      "Context: MR !12 (demo)"
    );
  });
});
