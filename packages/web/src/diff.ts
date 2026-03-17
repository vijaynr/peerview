import type { ParsedDiffLine } from "./types.js";

const HUNK_HEADER = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

export function parseUnifiedDiff(patch: string | undefined): ParsedDiffLine[] {
  if (!patch?.trim()) {
    return [];
  }

  const lines = patch.split("\n");
  const parsed: ParsedDiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const hunkMatch = line.match(HUNK_HEADER);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[3]);
      parsed.push({
        kind: "header",
        text: line,
        commentable: false,
      });
      continue;
    }

    if (line.startsWith("+")) {
      parsed.push({
        kind: "add",
        text: line,
        oldLineNumber: undefined,
        newLineNumber: newLine,
        commentable: true,
        positionType: "new",
      });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      parsed.push({
        kind: "remove",
        text: line,
        oldLineNumber: oldLine,
        newLineNumber: undefined,
        commentable: true,
        positionType: "old",
      });
      oldLine += 1;
      continue;
    }

    parsed.push({
      kind: "context",
      text: line,
      oldLineNumber: oldLine,
      newLineNumber: newLine,
      commentable: true,
      positionType: "new",
    });
    oldLine += 1;
    newLine += 1;
  }

  return parsed;
}
