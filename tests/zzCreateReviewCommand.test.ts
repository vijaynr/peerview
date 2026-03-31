import { describe, expect, it, mock } from "bun:test";
import { makeCoreMock, makeUiMock, makeWorkflowsMock } from "./mocks.ts";

const printCommandHelpMock = mock(() => {});
const runLiveTaskMock = mock(async (_title: string, run: (ui: unknown) => Promise<void>) => {
  await run({});
});
const createWorkflowStatusControllerMock = mock(() => ({
  status: {
    info: () => {},
    success: () => {},
    warning: () => {},
    error: () => {},
  },
  events: { emit: () => {} },
  stop: () => {},
  close: () => {},
  startSpinner: () => ({ stop: () => {}, stopAndPersist: () => {} }),
  completeSpinner: () => {},
}));
const runLiveCreateReviewTaskMock = mock(async (args: any) => {
  const workflow = args.runWorkflow({
    repoPath: args.repoPath,
    targetBranch: args.targetBranch,
    mode: args.mode,
    repoRoot: args.repoRoot,
  });
  await workflow.next();
});
const runCreateReviewWorkflowMock = mock((input: any) =>
  (async function* () {
    return {
      provider: input.provider,
      entityType: input.provider === "reviewboard" ? "review_request" : "merge_request",
      sourceLabel: "src",
      title: "title",
      description: "desc",
      action: "cancelled",
    };
  })()
);

mock.module("@pv/tui", () =>
  makeUiMock({
    printCommandHelp: printCommandHelpMock,
    runLiveTask: runLiveTaskMock,
    createWorkflowStatusController: createWorkflowStatusControllerMock,
    runLiveCreateReviewTask: runLiveCreateReviewTaskMock,
  })
);

mock.module("@pv/core", () =>
  makeCoreMock({
    repoRootFromModule: () => "/mock/root",
  })
);

mock.module("@pv/workflows", () =>
  makeWorkflowsMock({
    runCreateReviewWorkflow: runCreateReviewWorkflowMock,
  })
);

const { runCreateReviewCommand } = await import(
  "../packages/cli/src/commands/createReviewCommand.js"
);
const { runCreateMergeRequestCommand } = await import(
  "../packages/cli/src/commands/createMrCommand.js"
);

describe("create review command", () => {
  it("documents the generic command and provider flags", async () => {
    await runCreateReviewCommand(["--help"]);

    expect(printCommandHelpMock).toHaveBeenCalledTimes(1);
    const sections = printCommandHelpMock.mock.calls[0]?.[0] as Array<{
      title: string;
      lines: string[];
    }>;
    const options = sections.find((section) => section.title === "OPTIONS")?.lines.join("\n") ?? "";
    const examples =
      sections.find((section) => section.title === "EXAMPLES")?.lines.join("\n") ?? "";

    expect(options).toContain("--gl");
    expect(options).toContain("--reviewboard");
    expect(examples).toContain("pv create-review --reviewboard");
  });

  it("defaults create-review to GitLab", async () => {
    runCreateReviewWorkflowMock.mockClear();

    await runCreateReviewCommand([]);

    expect(runCreateReviewWorkflowMock).toHaveBeenCalledTimes(1);
    expect(runCreateReviewWorkflowMock.mock.calls[0]?.[0]).toMatchObject({ provider: "gitlab" });
  });

  it("routes --reviewboard to Review Board", async () => {
    runCreateReviewWorkflowMock.mockClear();

    await runCreateReviewCommand(["--reviewboard"]);

    expect(runCreateReviewWorkflowMock).toHaveBeenCalledTimes(1);
    expect(runCreateReviewWorkflowMock.mock.calls[0]?.[0]).toMatchObject({
      provider: "reviewboard",
    });
  });

  it("keeps create-mr as a GitLab alias", async () => {
    runCreateReviewWorkflowMock.mockClear();

    await runCreateMergeRequestCommand([]);

    expect(runCreateReviewWorkflowMock).toHaveBeenCalledTimes(1);
    expect(runCreateReviewWorkflowMock.mock.calls[0]?.[0]).toMatchObject({ provider: "gitlab" });
  });

  it("rejects conflicting provider flags", async () => {
    await expect(runCreateReviewCommand(["--gl", "--reviewboard"])).rejects.toThrow(
      "Pass only one provider flag"
    );
  });
});
