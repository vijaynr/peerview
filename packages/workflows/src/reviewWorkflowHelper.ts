import type { ReviewChatContext, ReviewChatHistoryEntry } from "@cr/core";

export { type DiffHunk, parseDiffHunks } from "./diffUtils.js";
export { buildInlineReviewPrompt, resolveInlinePosition } from "./reviewWorkflowInlineHelper.js";

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

export function injectMergeRequestContextIntoTemplate(
  template: string,
  context: {
    mrContent: string;
    mrChanges: string;
    mrCommits: string;
    guidelines?: string;
  }
): string {
  const hasPlaceholders =
    template.includes("{mr_content}") ||
    template.includes("{mr_changes}") ||
    template.includes("{mr_commits}") ||
    template.includes("{repo_guidelines}");

  if (hasPlaceholders) {
    return template
      .replaceAll("{mr_content}", context.mrContent)
      .replaceAll("{mr_changes}", context.mrChanges)
      .replaceAll("{mr_commits}", context.mrCommits)
      .replaceAll("{repo_guidelines}", context.guidelines ?? "(None provided)");
  }

  const sections = [
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
  ];

  if (context.guidelines) {
    sections.push("");
    sections.push("Repository specific guidelines (PRIORITIZE THESE):");
    sections.push(context.guidelines);
  }

  return sections.join("\n");
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
