import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HOME_DIR = os.homedir();
export const CR_DIR = path.join(HOME_DIR, ".cr");
export const CR_PROMPTS_DIR = path.join(CR_DIR, "prompts");
export const CR_ASSETS_DIR = path.join(CR_DIR, "assets");
export const CR_LOGS_DIR = path.join(CR_DIR, "logs");
export const CR_CONF_PATH = path.join(HOME_DIR, ".cr.conf");

export function repoRootFromModule(metaUrl: string): string {
  const thisFile = fileURLToPath(metaUrl);
  return path.resolve(path.dirname(thisFile), "..", "..");
}

export function resourcesPathFromRepoRoot(repoRoot: string): string {
  return path.join(repoRoot, "resources");
}
