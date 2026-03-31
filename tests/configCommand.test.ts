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
const readPVConfigContentsMock = mock(async () => "[cr]\nopenai_model = gpt-4.1\n");

mock.module("@pv/tui", () =>
  makeUiMock({
    createSpinner: createSpinnerMock,
    printInfo: printInfoMock,
    printRawOutput: printRawOutputMock,
    printWarning: printWarningMock,
  })
);

mock.module("@pv/core", () =>
  makeCoreMock({
    PV_CONF_PATH: "/mock/.pv.conf",
    readPVConfigContents: readPVConfigContentsMock,
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
    readPVConfigContentsMock.mockClear();
    delete process.env.PV_EDITOR;
    delete process.env.VISUAL;
    delete process.env.EDITOR;
  });

  it("prints raw config contents by default", async () => {
    await runConfigCommand([]);

    expect(readPVConfigContentsMock).toHaveBeenCalledTimes(1);
    expect(printRawOutputMock).toHaveBeenCalledWith("[cr]\nopenai_model = gpt-4.1\n");
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it("opens the config file in the configured editor for --edit", async () => {
    process.env.EDITOR = "vim";

    await runConfigCommand(["--edit"]);

    expect(printInfoMock).toHaveBeenCalledWith("Opening /mock/.pv.conf with vim");
    expect(spawnSyncMock).toHaveBeenCalledWith('vim "/mock/.pv.conf"', {
      stdio: "inherit",
      shell: true,
    });
    expect(readPVConfigContentsMock).not.toHaveBeenCalled();
  });

  it("warns when the config file does not exist", async () => {
    readPVConfigContentsMock.mockImplementationOnce(async () => null);

    await runConfigCommand([]);

    expect(printWarningMock).toHaveBeenCalledWith("Configuration file not found at /mock/.pv.conf");
  });
});
