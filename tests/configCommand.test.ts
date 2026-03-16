import { beforeEach, describe, expect, it, mock } from "bun:test";
import { makeCoreMock, makeUiMock } from "./mocks.ts";

const createSpinnerMock = mock(() => ({
  start() {
    return this;
  },
  stopAndPersist() {
    return this;
  },
}));
const printInfoMock = mock(() => {});
const printRawOutputMock = mock(() => {});
const printWarningMock = mock(() => {});
const spawnSyncMock = mock(() => ({ status: 0 }));
const readCRConfigContentsMock = mock(async () => "[cr]\nopenai_model = gpt-4.1\n");

mock.module("@cr/tui", () =>
  makeUiMock({
    createSpinner: createSpinnerMock,
    printInfo: printInfoMock,
    printRawOutput: printRawOutputMock,
    printWarning: printWarningMock,
  })
);

mock.module("@cr/core", () =>
  makeCoreMock({
    CR_CONF_PATH: "/mock/.cr.conf",
    readCRConfigContents: readCRConfigContentsMock,
  })
);

mock.module("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}));

const { runConfigCommand } = await import("../packages/cli/src/commands/configCommand.js");

describe("configCommand", () => {
  beforeEach(() => {
    createSpinnerMock.mockClear();
    printInfoMock.mockClear();
    printRawOutputMock.mockClear();
    printWarningMock.mockClear();
    spawnSyncMock.mockClear();
    readCRConfigContentsMock.mockClear();
    delete process.env.CR_EDITOR;
    delete process.env.VISUAL;
    delete process.env.EDITOR;
  });

  it("prints raw config contents by default", async () => {
    await runConfigCommand([]);

    expect(readCRConfigContentsMock).toHaveBeenCalledTimes(1);
    expect(printRawOutputMock).toHaveBeenCalledWith("[cr]\nopenai_model = gpt-4.1\n");
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it("opens the config file in the configured editor for --edit", async () => {
    process.env.EDITOR = "vim";

    await runConfigCommand(["--edit"]);

    expect(printInfoMock).toHaveBeenCalledWith("Opening /mock/.cr.conf with vim");
    expect(spawnSyncMock).toHaveBeenCalledWith('vim "/mock/.cr.conf"', {
      stdio: "inherit",
      shell: true,
    });
    expect(readCRConfigContentsMock).not.toHaveBeenCalled();
  });

  it("warns when the config file does not exist", async () => {
    readCRConfigContentsMock.mockImplementationOnce(async () => null);

    await runConfigCommand([]);

    expect(printWarningMock).toHaveBeenCalledWith("Configuration file not found at /mock/.cr.conf");
  });
});
