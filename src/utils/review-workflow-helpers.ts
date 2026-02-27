import type { ReviewChatContext, ReviewChatHistoryEntry } from "../types/workflows.js";

type DiffHunkRow =
  | { kind: "new"; line: number; content: string }
  | { kind: "old"; line: number; content: string }
  | { kind: "context"; oldLine: number; newLine: number; content: string };

export type DiffHunk = {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffHunkRow[];
  newChangedLines: number[];
  oldChangedLines: number[];
};

export function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/i);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // continue
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // continue
    }
  }

  return {};
}

export function parseDiffHunks(diffText: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("@@")) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (!match) {
        continue;
      }
      oldLine = Number.parseInt(match[1], 10);
      newLine = Number.parseInt(match[2], 10);
      currentHunk = {
        header: line,
        oldStart: oldLine,
        newStart: newLine,
        lines: [],
        newChangedLines: [],
        oldChangedLines: [],
      };
      hunks.push(currentHunk);
      continue;
    }

    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }

    if (line.startsWith("+")) {
      currentHunk?.newChangedLines.push(newLine);
      currentHunk?.lines.push({ kind: "new", line: newLine, content: line.slice(1) });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      currentHunk?.oldChangedLines.push(oldLine);
      currentHunk?.lines.push({ kind: "old", line: oldLine, content: line.slice(1) });
      oldLine += 1;
      continue;
    }

    const content = line.startsWith(" ") ? line.slice(1) : line;
    currentHunk?.lines.push({ kind: "context", oldLine, newLine, content });
    oldLine += 1;
    newLine += 1;
  }

  return hunks;
}

function normalizeSnippet(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function pickNearestLine(
  preferredLine: number | null,
  changedLines: { new: number[]; old: number[] },
  preferredType: "new" | "old" | null
): [number, "new" | "old"] {
  const pick = (lines: number[], type: "new" | "old"): [number, "new" | "old"] => {
    if (lines.length === 0) {
      return [1, "new"];
    }
    if (preferredLine === null) {
      return [lines[0], type];
    }
    const nearest = [...lines].sort(
      (a, b) => Math.abs(a - preferredLine) - Math.abs(b - preferredLine)
    )[0];
    return [nearest, type];
  };

  if (preferredType === "old" && changedLines.old.length > 0) {
    return pick(changedLines.old, "old");
  }
  if (preferredType === "new" && changedLines.new.length > 0) {
    return pick(changedLines.new, "new");
  }
  if (changedLines.new.length > 0) {
    return pick(changedLines.new, "new");
  }
  if (changedLines.old.length > 0) {
    return pick(changedLines.old, "old");
  }
  return [1, "new"];
}

export function resolveInlinePosition(
  preferredLine: unknown,
  preferredType: unknown,
  evidenceSnippet: unknown,
  diffHunks: DiffHunk[]
): [number, "new" | "old"] | null {
  const changedLines = { new: [] as number[], old: [] as number[] };
  for (const hunk of diffHunks) {
    changedLines.new.push(...hunk.newChangedLines);
    changedLines.old.push(...hunk.oldChangedLines);
  }

  const normalizedPreferredLine =
    typeof preferredLine === "number" && Number.isInteger(preferredLine) && preferredLine > 0
      ? preferredLine
      : null;
  const normalizedType =
    preferredType === "new" || preferredType === "old" ? (preferredType as "new" | "old") : null;

  if (normalizedPreferredLine !== null) {
    if (
      (normalizedType === null || normalizedType === "new") &&
      changedLines.new.includes(normalizedPreferredLine)
    ) {
      return [normalizedPreferredLine, "new"];
    }
    if (
      (normalizedType === null || normalizedType === "old") &&
      changedLines.old.includes(normalizedPreferredLine)
    ) {
      return [normalizedPreferredLine, "old"];
    }
  }

  if (typeof evidenceSnippet === "string" && evidenceSnippet.trim()) {
    const needle = normalizeSnippet(evidenceSnippet);
    const matches = new Set<string>();
    const matchedRows: Array<[number, "new" | "old"]> = [];

    for (const hunk of diffHunks) {
      for (const row of hunk.lines) {
        if (row.kind !== "new" && row.kind !== "old") {
          continue;
        }
        if (normalizedType && row.kind !== normalizedType) {
          continue;
        }
        if (normalizeSnippet(row.content).includes(needle)) {
          matches.add(`${row.line}:${row.kind}`);
          matchedRows.push([row.line, row.kind]);
        }
      }
    }

    if (matches.size === 1) {
      return matchedRows[0];
    }
    if (matches.size > 1 && normalizedPreferredLine !== null) {
      return [...matchedRows].sort(
        (a, b) =>
          Math.abs(a[0] - normalizedPreferredLine) - Math.abs(b[0] - normalizedPreferredLine)
      )[0];
    }
    if (matches.size > 1) {
      return null;
    }
  }

  if (changedLines.new.length > 0 || changedLines.old.length > 0) {
    return pickNearestLine(normalizedPreferredLine, changedLines, normalizedType);
  }

  return null;
}

export function injectMergeRequestContextIntoTemplate(
  template: string,
  context: {
    mrContent: string;
    mrChanges: string;
    mrCommits: string;
  }
): string {
  const hasPlaceholders =
    template.includes("{mr_content}") ||
    template.includes("{mr_changes}") ||
    template.includes("{mr_commits}");

  if (hasPlaceholders) {
    return template
      .replaceAll("{mr_content}", context.mrContent)
      .replaceAll("{mr_changes}", context.mrChanges)
      .replaceAll("{mr_commits}", context.mrCommits);
  }

  return [
    template.trim(),
    "",
    "Merge request details:",
    context.mrContent,
    "",
    "Merge request changes:",
    context.mrChanges,
    "",
    "Merge request commits:",
    context.mrCommits,
  ].join("\n");
}

// Backward-compatible alias; prefer injectMergeRequestContextIntoTemplate.
export const applyReviewTemplate = injectMergeRequestContextIntoTemplate;

function formatChatHistory(history: ReviewChatHistoryEntry[]): string {
  return history.map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`).join("\n\n");
}

export function buildChatPrompt(args: {
  question: string;
  history: ReviewChatHistoryEntry[];
  context: ReviewChatContext;
  chatTemplate?: string;
}): string {
  const historyText = formatChatHistory(args.history);
  const sections: string[] = [];

  if (args.chatTemplate?.trim()) {
    sections.push(args.chatTemplate.trim());
    sections.push("");
  }

  sections.push("You are an expert code assistant.");
  sections.push(`Question: ${args.question}`);
  sections.push("");
  if (historyText) {
    sections.push("Previous Q&A:");
    sections.push(historyText);
    sections.push("");
  }
  sections.push("Merge Request Content:");
  sections.push(args.context.mrContent);
  sections.push("");
  sections.push("Merge Request Changes:");
  sections.push(args.context.mrChanges);
  sections.push("");
  sections.push("Merge Request Commits:");
  sections.push(args.context.mrCommits);
  sections.push("");
  sections.push("MR Summary:");
  sections.push(args.context.summary);
  sections.push("");
  sections.push(
    "Use the above context to answer the question. If you don't know, say 'I don't know'."
  );
  sections.push(
    "IMPORTANT: Strictly avoid markdown headings; use plain text and bullets where helpful."
  );

  return sections.join("\n");
}
