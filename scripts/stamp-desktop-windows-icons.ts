/// <reference types="node" />
/// <reference types="bun" />

import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { rcedit } from "rcedit";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.join(scriptDir, "..");
const desktopDir = path.join(workspaceRoot, "packages", "desktop");
const buildDir = path.join(desktopDir, "build");
const iconPath = path.join(desktopDir, "icon.ico");
const executableNames = new Set(["launcher.exe"]);

export async function stampDesktopWindowsIcons(logPrefix = "[desktop-icons]") {
  if (process.platform !== "win32") {
    return [] as string[];
  }

  if (!existsSync(buildDir) || !existsSync(iconPath)) {
    return [] as string[];
  }

  const executables = collectExecutables(buildDir);
  const stamped: string[] = [];

  for (const executablePath of executables) {
    await stampExecutableIcon(executablePath);
    console.log(`${logPrefix} stamped ${path.relative(workspaceRoot, executablePath)}`);
    stamped.push(executablePath);
  }

  return stamped;
}

function collectExecutables(rootDir: string): string[] {
  const pending = [rootDir];
  const results: string[] = [];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    if (!currentDir) continue;

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }

      if (entry.isFile() && executableNames.has(entry.name.toLowerCase())) {
        results.push(entryPath);
      }
    }
  }

  return results;
}

export function getExecutableMtimes(): Map<string, number> {
  const mtimes = new Map<string, number>();
  if (!existsSync(buildDir)) return mtimes;

  for (const executablePath of collectExecutables(buildDir)) {
    mtimes.set(executablePath, statSync(executablePath).mtimeMs);
  }

  return mtimes;
}

export async function stampExecutableIcon(executablePath: string) {
  await rcedit(executablePath, { icon: iconPath });
}

const isMainModule =
  typeof process !== "undefined" &&
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  try {
    const stamped = await stampDesktopWindowsIcons();
    if (process.platform === "win32" && stamped.length === 0) {
      console.log("[desktop-icons] no Windows executables found to stamp");
    }
  } catch (error) {
    console.error("[desktop-icons] failed to stamp Windows icons:", error);
    process.exit(1);
  }
}