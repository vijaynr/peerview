import type { WorkflowKind } from "../types/workflows.js";

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
  local: boolean
): { heading: string; description: string } {
  if (workflow === "chat") {
    return {
      heading: "Code Review Chat",
      description: "Interactive Q&A over merge request context.",
    };
  }

  if (workflow === "summarize") {
    return {
      heading: local ? "Local Changes Summary" : "Merge Request Summary",
      description: local
        ? "Generate a concise summary of local diff changes."
        : "Generate a concise summary for the selected merge request.",
    };
  }

  return {
    heading: local ? "Local Code Review" : "Merge Request Review",
    description: local
      ? "Review local diff changes and generate feedback."
      : "Review the selected merge request and generate feedback.",
  };
}

export function getWorkflowResultTitle(workflow: ReviewWorkflowKind, local: boolean): string {
  if (workflow === "chat") {
    return "Workflow: Code Review Chat";
  }
  if (workflow === "summarize") {
    return local ? "Workflow: Local Changes Summary" : "Workflow: Merge Request Summary";
  }
  return "Workflow: Code Review";
}

export function buildCreateMrResultBody(result: {
  action: "updated" | "created" | "cancelled";
  sourceBranch: string;
  targetBranch: string;
  title: string;
  mergeRequestUrl?: string;
}): string {
  const status =
    result.action === "updated"
      ? "Merge Request Updated"
      : result.action === "created"
        ? "Merge Request Created"
        : "Merge Request Cancelled";
  const bodyLines = [
    `Status: ${status}`,
    `Source: ${result.sourceBranch}`,
    `Target: ${result.targetBranch}`,
    `Title: ${result.title}`,
  ];
  if (result.mergeRequestUrl) {
    bodyLines.push(`URL: ${result.mergeRequestUrl}`);
  }
  return bodyLines.join("\n");
}
