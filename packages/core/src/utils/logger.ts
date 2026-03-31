import fs from "node:fs/promises";
import path from "node:path";
import { PV_LOGS_DIR } from "./paths.js";

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_PATH = path.join(PV_LOGS_DIR, "pv.log");

function formatEntry(level: LogLevel, context: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const paddedLevel = level.padEnd(5);
  let line = `${ts} [${paddedLevel}] [${context}] ${message}`;
  if (data !== undefined) {
    if (data instanceof Error) {
      line += `\n  ${data.message}`;
      if (data.stack) {
        line += `\n  ${data.stack.split("\n").join("\n  ")}`;
      }
    } else {
      try {
        line += `\n  ${JSON.stringify(data, null, 2).split("\n").join("\n  ")}`;
      } catch {
        line += `\n  [unserializable]`;
      }
    }
  }
  return line + "\n";
}

class Logger {
  private queue: Promise<void> = Promise.resolve();
  private dirReady = false;

  private enqueue(entry: string): void {
    this.queue = this.queue
      .then(async () => {
        if (!this.dirReady) {
          await fs.mkdir(PV_LOGS_DIR, { recursive: true });
          this.dirReady = true;
        }
        await fs.appendFile(LOG_PATH, entry, "utf-8");
      })
      .catch(() => {
        // never let logging failures crash the app
      });
  }

  trace(context: string, message: string, data?: unknown): void {
    this.enqueue(formatEntry("TRACE", context, message, data));
  }

  debug(context: string, message: string, data?: unknown): void {
    this.enqueue(formatEntry("DEBUG", context, message, data));
  }

  info(context: string, message: string, data?: unknown): void {
    this.enqueue(formatEntry("INFO", context, message, data));
  }

  success(context: string, message: string, data?: unknown): void {
    this.enqueue(formatEntry("INFO", context, `SUCCESS: ${message}`, data));
  }

  warn(context: string, message: string, data?: unknown): void {
    this.enqueue(formatEntry("WARN", context, message, data));
  }

  error(context: string, message: string, data?: unknown): void {
    this.enqueue(formatEntry("ERROR", context, message, data));
  }
}

export const logger = new Logger();
