import type { GitLabInlineComment } from "@cr/core";
import type { DiffHunk } from "./diffUtils.js";

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

export function buildInlineReviewPrompt(args: {
  filePath: string;
  diffText: string;
  mrContent: string;
  mrCommits: string;
  existingInlineComments: GitLabInlineComment[];
  userFeedback?: string;
  guidelines?: string;
}): string {
  const existing = args.existingInlineComments.map((c) => ({
    line: c.line,
    position_type: c.positionType,
    body: c.body,
  }));
  const sections = [
    "You are reviewing one file from a merge request.",
    "Return ONLY valid JSON in this format:",
    '{"findings":[{"should_comment": true|false, "severity":"Critical|High|Medium|Low", "summary": "string", "suggested_fix": "string|null", "line": number|null, "position_type":"new|old|null", "evidence_snippet":"string|null"}]}',
    "",
    "Rules:",
    "- Return one finding object per distinct issue in this file.",
    "- If no issues, return an empty list for findings.",
    "- should_comment=true only for actionable issues.",
    "- summary must be concise and specific.",
    "- suggested_fix must provide a concrete code-level fix when should_comment=true.",
    "- suggested_fix should be null when should_comment=false.",
    "- line should be the most relevant changed line number from this diff if possible.",
    "- position_type should be 'old' for deleted-code issues; otherwise use 'new' when possible.",
    "- evidence_snippet should be a short exact code phrase from the relevant changed line.",
    "- Do not repeat feedback that already exists in inline discussions.",
    "",
  ];

  if (args.guidelines) {
    sections.push("Repository specific guidelines (PRIORITIZE THESE):");
    sections.push(args.guidelines);
    sections.push("");
  }

  sections.push("MR details:");
  sections.push(args.mrContent);
  sections.push("");
  sections.push("Commits:");
  sections.push(args.mrCommits);
  sections.push("");
  sections.push(`File path: ${args.filePath}`);
  sections.push(`Existing inline comments for this file:\n${JSON.stringify(existing)}`);
  sections.push("");
  sections.push(`Diff:\n${args.diffText}`);

  const body = sections.join("\n");

  if (args.userFeedback?.trim()) {
    return `Human feedback for this re-run:\n${args.userFeedback.trim()}\n\n${body}`;
  }
  return body;
}
