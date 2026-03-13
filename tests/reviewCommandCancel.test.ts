import { describe, expect, it, mock } from "bun:test";

const promptWithFrameMock = mock(async () => ({}));
const setResultMock = mock(() => {});
const runLiveTaskMock = mock(async (_title: string, run: (ui: any) => Promise<void>) => {
  await run({
    setResult: setResultMock,
  });
});

mock.module("@cr/ui", () => ({
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
  printReviewSummary: mock(() => {}),
}));

mock.module("@cr/core", () => ({
  envOrConfig: (_key: string, value: string | undefined, fallback: string) => value || fallback,
  loadCRConfig: mock(async () => ({})),
  repoRootFromModule: () => "/mock/root",
}));

mock.module("@cr/workflows", () => ({
  maybePostReviewComment: mock(async () => null),
  maybePostReviewBoardComment: mock(async () => null),
  runReviewWorkflow: mock(async () => ({})),
  answerReviewChatQuestion: mock(async () => ({ answer: "", history: [] })),
  runInteractiveReviewSession: mock(async function* () {
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
  }),
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
});
