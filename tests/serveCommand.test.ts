import { describe, expect, it, mock } from "bun:test";
import { makeUiMock } from "./mocks.ts";

const printCommandHelpMock = mock(() => {});
const printErrorMock = mock(() => {});

mock.module("@cr/tui", () =>
  makeUiMock({
    printCommandHelp: printCommandHelpMock,
    printError: printErrorMock,
  })
);

mock.module("@cr/webhook", () => ({
  startWebhookServer: async () => ({}),
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

    expect(options).toContain("one webhook server");
    expect(examples).toContain("/gitlab");
    expect(examples).toContain("/reviewboard");
    expect(examples).toContain("review_request_published");
    expect(examples).toContain("HMAC secret");
  });
});
