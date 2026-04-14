/// <reference types="node" />
/// <reference types="bun" />

import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  getExecutableMtimes,
  stampExecutableIcon,
} from "./stamp-desktop-windows-icons.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(scriptDir, "..");
const desktopDir = path.join(workspaceRoot, "packages", "desktop");
const env = { ...process.env, TAR_OPTIONS: process.env.TAR_OPTIONS ?? "--force-local" };

await runCommand(["bun", "../../scripts/generate-desktop-icons.ts"]);

const child = Bun.spawn(["bun", "run", "electrobun", "dev", "--watch"], {
  cwd: desktopDir,
  env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

let stopped = false;
const stampedMtimes = new Map<string, number>();
const failedMtimes = new Map<string, number>();

const timer = setInterval(async () => {
  if (stopped || process.platform !== "win32") {
    return;
  }

  const currentMtimes = getExecutableMtimes();
  for (const [filePath, mtime] of currentMtimes) {
    const lastStampedMtime = stampedMtimes.get(filePath);
    if (lastStampedMtime === mtime) {
      continue;
    }

    try {
      await stampExecutableIcon(filePath);
      const restampedMtime = getExecutableMtimes().get(filePath) ?? mtime;
      stampedMtimes.set(filePath, restampedMtime);
      failedMtimes.delete(filePath);
      console.log(`[desktop-icons/watch] stamped ${path.relative(workspaceRoot, filePath)}`);
    } catch (error) {
      if (failedMtimes.get(filePath) === mtime) {
        continue;
      }

      failedMtimes.set(filePath, mtime);
      console.warn(`[desktop-icons/watch] icon stamp failed for ${path.basename(filePath)}:`, error);
    }
  }
}, 1500);

const exitCode = await child.exited;
stopped = true;
clearInterval(timer);
process.exit(exitCode ?? 0);

async function runCommand(cmd: string[]) {
  const child = Bun.spawn(cmd, {
    cwd: desktopDir,
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await child.exited;
  if (exitCode !== 0) {
    process.exit(exitCode ?? 1);
  }
}