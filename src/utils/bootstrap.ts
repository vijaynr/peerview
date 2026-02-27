import fs from "node:fs/promises";
import path from "node:path";
import { CR_ASSETS_DIR, CR_DIR, CR_LOGS_DIR, CR_PROMPTS_DIR } from "./paths.js";
import { bundledAssets, bundledPrompts } from "../resources/index.js";

async function writeBundledFiles(targetDir: string, files: Record<string, string>): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const targetPath = path.join(targetDir, name);
    await fs.writeFile(targetPath, content, "utf-8");
  }
}

export async function initializeCRHome(_repoRoot: string): Promise<void> {
  await fs.mkdir(CR_DIR, { recursive: true });
  await fs.mkdir(CR_PROMPTS_DIR, { recursive: true });
  await fs.mkdir(CR_ASSETS_DIR, { recursive: true });
  await fs.mkdir(CR_LOGS_DIR, { recursive: true });

  await writeBundledFiles(CR_PROMPTS_DIR, bundledPrompts);
  await writeBundledFiles(CR_ASSETS_DIR, bundledAssets);
}
