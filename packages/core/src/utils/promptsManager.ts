import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { bundledPrompts } from "../resources/index.js";
import { PV_PROMPTS_DIR } from "./paths.js";

export const DEFAULT_REVIEW_AGENT_NAME = "general";
const REVIEW_AGENT_PROMPT_DIR = "review-agents";

export async function loadPrompt(promptFileName: string, _repoRoot: string): Promise<string> {
  const userPrompt = path.join(PV_PROMPTS_DIR, promptFileName);
  if (existsSync(userPrompt)) {
    return fs.readFile(userPrompt, "utf-8");
  }

  const bundledPrompt = bundledPrompts[promptFileName as keyof typeof bundledPrompts];
  if (!bundledPrompt) {
    throw new Error(`Unknown bundled prompt: ${promptFileName}`);
  }
  return bundledPrompt;
}

export function getReviewAgentPromptFileName(agentName: string): string {
  return `${REVIEW_AGENT_PROMPT_DIR}/${agentName}.txt`;
}

export async function loadReviewAgentPrompt(agentName: string, repoRoot: string): Promise<string> {
  return loadPrompt(getReviewAgentPromptFileName(agentName), repoRoot);
}

export function listBundledReviewAgentNames(): string[] {
  return Object.keys(bundledPrompts)
    .filter((name) => name.startsWith(`${REVIEW_AGENT_PROMPT_DIR}/`) && name.endsWith(".txt"))
    .map((name) => name.slice(REVIEW_AGENT_PROMPT_DIR.length + 1, -4))
    .sort();
}

export function normalizeReviewAgentNames(agentNames?: string[]): string[] {
  const normalized = Array.from(
    new Set(
      (agentNames ?? []).map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0)
    )
  );

  return normalized.length > 0 ? normalized : [DEFAULT_REVIEW_AGENT_NAME];
}
