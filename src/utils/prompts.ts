import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { CR_PROMPTS_DIR } from "./paths.js";
import { bundledPrompts } from "../resources/index.js";

export async function loadPrompt(promptFileName: string, _repoRoot: string): Promise<string> {
  const userPrompt = path.join(CR_PROMPTS_DIR, promptFileName);
  if (existsSync(userPrompt)) {
    return fs.readFile(userPrompt, "utf-8");
  }

  const bundledPrompt = bundledPrompts[promptFileName as keyof typeof bundledPrompts];
  if (!bundledPrompt) {
    throw new Error(`Unknown bundled prompt: ${promptFileName}`);
  }
  return bundledPrompt;
}
