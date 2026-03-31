import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HOME_DIR = os.homedir();
export const PV_DIR = path.join(HOME_DIR, ".pv");
export const PV_PROMPTS_DIR = path.join(PV_DIR, "prompts");
export const PV_ASSETS_DIR = path.join(PV_DIR, "assets");
export const PV_LOGS_DIR = path.join(PV_DIR, "logs");
export const PV_CONF_PATH = path.join(HOME_DIR, ".pv.conf");
export const PV_CONF_KEY_PATH = path.join(PV_DIR, "config.key");

export function repoRootFromModule(metaUrl: string): string {
  const thisFile = fileURLToPath(metaUrl);
  return path.resolve(path.dirname(thisFile), "..", "..");
}

export function resourcesPathFromRepoRoot(repoRoot: string): string {
  return path.join(repoRoot, "resources");
}
