import type { WorkflowKind } from "@pv/core";

export type ReviewWorkflowKind = WorkflowKind;

export function getFlag(args: string[], key: string, fallback: string, short?: string): string {
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
}

export function hasFlag(args: string[], key: string): boolean {
  return args.includes(`--${key}`);
}

export async function readStdinDiff(): Promise<string | undefined> {
  if (process.stdin.isTTY) {
    return undefined;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export function getWorkflowHeadingAndDescription(
  workflow: ReviewWorkflowKind,
  local: boolean,
  provider?: string
): { heading: string; description: string } {
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
}

export function getWorkflowResultTitle(
  workflow: ReviewWorkflowKind,
  local: boolean,
  provider?: string
): string {
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
}
