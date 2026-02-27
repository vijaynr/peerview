import fs from "node:fs";
import path from "node:path";
import { renderMarkdownForTerminal } from "../utils/markdown";
import { CR_ASSETS_DIR } from "../utils/paths.js";
import { bundledAssets } from "../resources/index.js";
import { COLORS, DOT, BORDERS, BANNER_COLOR } from "./constants.js";

let cachedBannerText: string | null = null;
const BINARY_BANNER_LABEL = "cr-cli";
const BANNER_SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&*";

function getTerminalWidth(): number {
  return process.stdout.columns ?? 80;
}

function loadBannerText(): string {
  if (cachedBannerText !== null) {
    return cachedBannerText;
  }

  try {
    const userBannerPath = path.join(CR_ASSETS_DIR, "banner.txt");
    const bannerText = fs.existsSync(userBannerPath)
      ? fs.readFileSync(userBannerPath, "utf-8")
      : bundledAssets["banner.txt"];
    cachedBannerText = bannerText.trimEnd();
  } catch {
    cachedBannerText = "CR CLI";
  }

  return cachedBannerText;
}

function toBinaryText(value: string): string {
  return value
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join(" ");
}

function scrambleBinaryText(binaryText: string, jitter: number): string {
  let out = "";
  for (const char of binaryText) {
    if (char === "0" || char === "1") {
      out += Math.random() < jitter ? (char === "0" ? "1" : "0") : char;
      continue;
    }
    out += char;
  }
  return out;
}

function scrambleBannerLine(line: string, jitter: number): string {
  let out = "";
  for (const char of line) {
    if (char === " ") {
      out += char;
      continue;
    }
    if (Math.random() < jitter) {
      const idx = Math.floor(Math.random() * BANNER_SCRAMBLE_CHARS.length);
      out += BANNER_SCRAMBLE_CHARS[idx] ?? char;
      continue;
    }
    out += char;
  }
  return out;
}

function shouldAnimateBanner(): boolean {
  return Boolean(process.stdout.isTTY);
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function renderBinaryLines(lines: string[], terminalWidth: number): void {
  for (const line of lines) {
    process.stdout.write(
      COLORS.cyan + COLORS.dim + centerLine(line, terminalWidth) + COLORS.reset + "\n"
    );
  }
}

function renderBannerLines(lines: string[]): void {
  for (const line of lines) {
    process.stdout.write(BANNER_COLOR + COLORS.bold + line + COLORS.reset + "\n");
  }
}

async function renderAnimatedBinary(binaryLines: string[], terminalWidth: number): Promise<void> {
  const frameCount = 16;
  const frameDelayMs = 70;
  for (let frame = 0; frame < frameCount; frame += 1) {
    if (frame > 0) {
      process.stdout.write("\x1b[F".repeat(binaryLines.length));
    }
    const jitter = (frameCount - 1 - frame) / (frameCount - 1);
    const frameLines = binaryLines.map((line) => scrambleBinaryText(line, jitter));
    renderBinaryLines(frameLines, terminalWidth);
    await sleep(frameDelayMs);
  }
}

async function renderAnimatedBannerText(
  bannerLines: string[],
  binaryLines: string[],
  terminalWidth: number
): Promise<void> {
  const frameCount = 12;
  const frameDelayMs = 60;
  const totalLines = bannerLines.length + binaryLines.length;

  for (let frame = 0; frame < frameCount; frame += 1) {
    process.stdout.write("\x1b[F".repeat(totalLines));
    const jitter = (frameCount - 1 - frame) / (frameCount - 1);
    const frameBanner = bannerLines.map((line) => scrambleBannerLine(line, jitter));
    renderBannerLines(frameBanner);
    renderBinaryLines(binaryLines, terminalWidth);
    await sleep(frameDelayMs);
  }
}

function wrapTextByWidth(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ` ${word}`;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function centerLine(text: string, width: number): string {
  if (text.length >= width) {
    return text;
  }
  const leftPad = Math.floor((width - text.length) / 2);
  return `${" ".repeat(leftPad)}${text}`;
}

function renderMarkdown(text: string): string {
  return renderMarkdownForTerminal(text);
}

export function printWorkflowOutput(props: {
  title: string;
  output: string;
  contextLabel?: string;
  metadataLines?: string[];
}): void {
  printHorizontalLine();
  console.log();
  const rendered = renderMarkdown(props.output);
  console.log(rendered);
}

function printSection(
  title: string,
  lines: string[],
  color: string = COLORS.cyan,
  opts?: { bullet?: boolean }
): void {
  const bullet = opts?.bullet ?? true;
  printHorizontalLine(color);
  console.log();
  console.log(color + COLORS.bold + title + COLORS.reset);
  console.log();
  for (const line of lines) {
    if (!line.trim()) {
      console.log();
      continue;
    }
    console.log(color + `${bullet ? `${DOT} ` : ""}` + line + COLORS.reset);
  }
  console.log();
}

function formatHelpRows(rows: Array<{ cmd: string; desc: string }>): string[] {
  const width = Math.max(...rows.map((row) => row.cmd.length), 0);
  return rows.map((row) => `${row.cmd.padEnd(width)}  ${row.desc}`);
}

export function printHorizontalLine(color: string = COLORS.cyan): void {
  const width = getTerminalWidth() - 1;
  console.log(color + BORDERS.horizontal.repeat(width) + COLORS.reset);
}

export async function printBanner(): Promise<void> {
  const banner = loadBannerText();
  const terminalWidth = getTerminalWidth();
  const centeredBannerLines = banner.split("\n").map((line) => centerLine(line, terminalWidth));
  const binary = toBinaryText(BINARY_BANNER_LABEL);
  const wrappedBinary = wrapTextByWidth(binary, 80);
  console.log();
  renderBannerLines(centeredBannerLines);
  if (shouldAnimateBanner()) {
    await renderAnimatedBinary(wrappedBinary, terminalWidth);
    await renderAnimatedBannerText(centeredBannerLines, wrappedBinary, terminalWidth);
  } else {
    renderBinaryLines(wrappedBinary, terminalWidth);
  }
  console.log();
}

export function printSuccess(message: string): void {
  console.log(COLORS.green + `${DOT} ` + message + COLORS.reset);
}

export function printWarning(message: string): void {
  console.log(COLORS.yellow + `${DOT} ` + message + COLORS.reset);
}

export function printError(message: string): void {
  console.error(COLORS.red + `${DOT} ` + message + COLORS.reset);
}

export function printAlert(props: {
  title: string;
  message: string;
  tone?: "info" | "success" | "warning" | "error";
  bullet?: boolean;
}): void {
  const tone = props.tone ?? "info";
  const colorMap = {
    info: COLORS.cyan,
    success: COLORS.green,
    warning: COLORS.yellow,
    error: COLORS.red,
  };
  const color = colorMap[tone];
  printSection(props.title, props.message.split("\n"), color, { bullet: props.bullet });
}

export function printCommandHelp(sections: { title: string; lines: string[] }[]): void {
  console.log();
  for (const section of sections) {
    console.log(section.title);
    console.log();
    for (const line of section.lines) {
      console.log("  " + line);
    }
    console.log();
  }
}

export function printHelpView(): void {
  const commandRows = formatHelpRows([
    { cmd: "cr init", desc: "Configure API and GitLab settings." },
    { cmd: "cr review", desc: "Run review, summarize, chat, or create workflows." },
    { cmd: "cr help", desc: "Show this help screen." },
  ]);

  const workflowRows = formatHelpRows([
    { cmd: "cr review --workflow default", desc: "Code review for a merge request." },
    { cmd: "cr review --workflow summarize", desc: "Summary of merge request changes." },
    { cmd: "cr review --workflow chat", desc: "Interactive Q&A over MR context." },
    { cmd: "cr review --workflow create", desc: "Create/update merge request draft." },
  ]);

  const exampleRows = [
    "cr review --path .",
    "cr review --workflow summarize --path .",
    "cr review --workflow create --path . --target-branch main",
    "git diff | cr review --local",
  ];

  console.log();
  console.log("COMMANDS");
  console.log();
  for (const line of commandRows) {
    console.log("  " + line);
  }
  console.log();

  console.log("WORKFLOWS");
  console.log();
  for (const line of workflowRows) {
    console.log("  " + line);
  }
  console.log();

  console.log("EXAMPLES");
  console.log();
  for (const line of exampleRows) {
    console.log("  " + line);
  }
  console.log();

  console.log("TIP");
  console.log();
  console.log("  Use `cr review --help` for complete review options.");
  console.log();
}

export function printReviewComment(props: { contextLabel: string; output: string }): void {
  printWorkflowOutput({
    title: "Generated Review Comment",
    contextLabel: props.contextLabel,
    output: props.output,
  });
}

export function printReviewSummary(props: { contextLabel: string; output: string }): void {
  printWorkflowOutput({
    title: "Generated Review Summary",
    contextLabel: props.contextLabel,
    output: props.output,
  });
}

export function printChatAnswer(answer: string, contextLabel?: string): void {
  printWorkflowOutput({
    title: "Chat Answer",
    contextLabel,
    output: answer,
  });
}

export const __test__ = {
  toBinaryText,
  wrapTextByWidth,
  centerLine,
};
