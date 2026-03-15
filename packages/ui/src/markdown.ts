import { createRequire } from "node:module";
import type { MarkedExtension } from "marked";
import { marked } from "marked";

const require = createRequire(import.meta.url);

let markdownRendererInitialized = false;
let markdownRendererAvailable = false;

function ensureMarkdownRenderer(): boolean {
  if (markdownRendererInitialized) {
    return markdownRendererAvailable;
  }
  markdownRendererInitialized = true;

  try {
    const maybeModule = require("marked-terminal") as
      | ((options?: unknown) => unknown)
      | {
          markedTerminal?: (options?: unknown) => unknown;
          default?: (options?: unknown) => unknown;
        };
    const pluginFactory =
      typeof maybeModule === "function"
        ? maybeModule
        : typeof maybeModule.markedTerminal === "function"
          ? maybeModule.markedTerminal
          : typeof maybeModule.default === "function"
            ? maybeModule.default
            : null;
    if (!pluginFactory) {
      return false;
    }

    const extension = pluginFactory({
      reflowText: true,
      width: process.stdout.columns ?? 80,
    }) as MarkedExtension;
    marked.use(extension);
    markdownRendererAvailable = true;
  } catch {
    markdownRendererAvailable = false;
  }

  return markdownRendererAvailable;
}

export function renderMarkdownForTerminal(text: string): string {
  if (!ensureMarkdownRenderer()) {
    return text;
  }
  try {
    const rendered = marked.parse(text, { async: false });
    return typeof rendered === "string" ? rendered : text;
  } catch {
    return text;
  }
}
