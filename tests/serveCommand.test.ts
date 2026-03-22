import { describe, expect, it, mock } from "bun:test";
import { makeUiMock } from "./mocks.ts";

const printCommandHelpMock = mock(() => {});
const printErrorMock = mock(() => {});
const startServerMock = mock(async () => ({}));

mock.module("@cr/tui", () =>
  makeUiMock({
    printCommandHelp: printCommandHelpMock,
    printError: printErrorMock,
  })
);

mock.module("@cr/server", () => ({
  startServer: startServerMock,
}));

const { runServeCommand } = await import("../packages/cli/src/commands/serveCommand.js");

describe("serveCommand help", () => {
  it("documents unified webhook paths and Review Board setup guidance", async () => {
    await runServeCommand(["--help"]);

    expect(printCommandHelpMock).toHaveBeenCalledTimes(1);
    const sections = printCommandHelpMock.mock.calls[0]?.[0] as Array<{
      title: string;
      lines: string[];
    }>;
    const options = sections.find((section) => section.title === "OPTIONS")?.lines.join("\n") ?? "";
    const examples =
      sections.find((section) => section.title === "EXAMPLES")?.lines.join("\n") ?? "";

    expect(options).not.toContain("--web");
    expect(options).not.toContain("--webhook");
    expect(examples).toContain("cr serve");
    expect(examples).toContain("/webhook/gitlab");
    expect(examples).toContain("/webhook/github");
    expect(examples).toContain("/webhook/reviewboard");
    expect(examples).toContain("http://host:3000/web");
    expect(examples).toContain("http://host:3000/");
    expect(examples).toContain("review_request_published");
    expect(examples).toContain("HMAC secret");
  });

  it("starts the full server stack by default", async () => {
    await runServeCommand([]);

    expect(startServerMock).toHaveBeenCalledTimes(1);
    expect(startServerMock.mock.calls[0]?.[0]).toBe(3000);
    expect(startServerMock.mock.calls[0]?.[1]).toMatchObject({
      enableWeb: true,
      enableWebhook: true,
      repoPath: process.cwd(),
    });
  });
});
