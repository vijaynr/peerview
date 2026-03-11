import { renderMarkdownForTerminal } from "./markdown.js";
import { COLORS, DOT, BORDERS, BANNER_COLOR } from "./constants.js";
import { BANNER_TEXT, BANNER_LOGO } from "./banner.js";

let cachedBannerText: string | null = null;
const BINARY_BANNER_LABEL = "cr-cli";
const BANNER_SCRAMBLE_CHARS = "10101010010101010010101010101010101010";

function getTerminalWidth(): number {
  return process.stdout.columns ?? 80;
}

function loadBannerText(): string {
  if (cachedBannerText !== null) {
    return cachedBannerText;
  }

  try {
    cachedBannerText = BANNER_TEXT;
  } catch {
    cachedBannerText = "CodeReviewer CLI";
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

function renderBinaryLines(lines: string[]): void {
  for (const line of lines) {
    process.stdout.write(COLORS.cyan + COLORS.dim + line + COLORS.reset + "\n");
  }
}

function renderBannerLines(lines: string[]): void {
  for (const line of lines) {
    process.stdout.write(BANNER_COLOR + COLORS.bold + line + COLORS.reset + "\n");
  }
}

async function renderAnimatedBinary(binaryLines: string[]): Promise<void> {
  const frameCount = 16;
  const frameDelayMs = 70;
  for (let frame = 0; frame < frameCount; frame += 1) {
    if (frame > 0) {
      process.stdout.write("\x1b[F".repeat(binaryLines.length));
    }
    const jitter = (frameCount - 1 - frame) / (frameCount - 1);
    const frameLines = binaryLines.map((line) => scrambleBinaryText(line, jitter));
    renderBinaryLines(frameLines);
    await sleep(frameDelayMs);
  }
}

async function renderAnimatedBannerText(
  bannerLines: string[],
  binaryLines: string[]
): Promise<void> {
  const frameCount = 12;
  const frameDelayMs = 60;
  const totalLines = bannerLines.length + binaryLines.length;

  for (let frame = 0; frame < frameCount; frame += 1) {
    process.stdout.write("\x1b[F".repeat(totalLines));
    const jitter = (frameCount - 1 - frame) / (frameCount - 1);
    const frameBanner = bannerLines.map((line) => scrambleBannerLine(line, jitter));
    renderBannerLines(frameBanner);
    renderBinaryLines(binaryLines);
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
  printDivider();
  const rendered = renderMarkdown(props.output).trimEnd();
  console.log(rendered);
}

function printSection(
  title: string,
  lines: string[],
  color: string = COLORS.cyan,
  opts?: { bullet?: boolean }
): void {
  const bullet = opts?.bullet ?? true;
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
}

function formatHelpRows(rows: Array<{ cmd: string; desc: string }>): string[] {
  const width = Math.max(...rows.map((row) => row.cmd.length), 0);
  return rows.map((row) => `${row.cmd.padEnd(width)}  ${row.desc}`);
}

export function printHorizontalLine(color: string = COLORS.cyan): void {
  const width = getTerminalWidth() - 1;
  console.log(color + BORDERS.horizontal.repeat(width) + COLORS.reset);
}

export function printDivider(color: string = COLORS.cyan): void {
  console.log();
  printHorizontalLine(color);
  console.log();
}

export function printHeaderBox(): void {
  // Strip leading/trailing blank lines from logo
  const rawLogoLines = BANNER_LOGO.split("\n");
  const firstNonBlank = rawLogoLines.findIndex((l) => l.trim() !== "");
  const lastNonBlank = rawLogoLines.reduce((acc, l, i) => (l.trim() !== "" ? i : acc), -1);
  const logoLines = firstNonBlank === -1 ? [] : rawLogoLines.slice(firstNonBlank, lastNonBlank + 1);
  const logoWidth = logoLines.length > 0 ? Math.max(...logoLines.map((l) => l.length)) : 0;

  const GAP = "  ";
  const RIGHT_PAD = 6;
  const title = `cr  ⬤  code reviewer`;
  const desc = `vibecheck your codebase`;
  const version = `v0.1.0`;

  // Row 0: logo[0] + GAP + title; Row 1: logo[1] + GAP + desc
  const titleRowContent = GAP + title;
  const descRowContent = GAP + desc;
  const titleRowVisible = 1 + logoWidth + titleRowContent.length + RIGHT_PAD;
  const descRowVisible = 1 + logoWidth + descRowContent.length + RIGHT_PAD;
  const innerWidth = Math.max(titleRowVisible, descRowVisible);

  const top = BORDERS.topLeft + BORDERS.horizontal.repeat(innerWidth) + BORDERS.topRight;
  const bot = BORDERS.bottomLeft + BORDERS.horizontal.repeat(innerWidth) + BORDERS.bottomRight;

  const renderRow = (colored: string, visibleLen: number): string => {
    const rightPad = " ".repeat(innerWidth - visibleLen);
    return (
      COLORS.cyan +
      BORDERS.vertical +
      colored +
      rightPad +
      COLORS.cyan +
      BORDERS.vertical +
      COLORS.reset
    );
  };

  console.log();
  console.log(COLORS.cyan + COLORS.bold + top + COLORS.reset);

  // Logo rows — row 0: title, row 2: desc, rest: empty
  for (let i = 0; i < logoLines.length; i++) {
    const logoStr = logoLines[i]!;
    const isFirst = i === 0;
    const isThird = i === 2;
    const textSuffix = isFirst ? GAP + title : isThird ? GAP + desc : "";
    const visibleLen = 1 + logoWidth + textSuffix.length;
    const colored =
      " " +
      BANNER_COLOR +
      COLORS.bold +
      logoStr +
      COLORS.reset +
      " ".repeat(logoWidth - logoStr.length) +
      (isFirst ? COLORS.cyan + COLORS.bold + GAP + title + COLORS.reset : "") +
      (isThird ? COLORS.dim + GAP + desc + COLORS.reset : "");
    console.log(renderRow(colored, visibleLen));
  }

  // Version row — left-padded to align under the logo
  const versionColored = " " + COLORS.dim + " " + version + COLORS.reset;
  const versionVisibleLen = 1 + 1 + version.length;
  console.log(renderRow(versionColored, versionVisibleLen));

  console.log(COLORS.cyan + COLORS.bold + bot + COLORS.reset);
  console.log();
}

export async function printBanner(): Promise<void> {
  const banner = loadBannerText();
  const bannerLines = banner.split("\n");
  const binary = toBinaryText(BINARY_BANNER_LABEL);
  const wrappedBinary = wrapTextByWidth(binary, 80);
  console.log();
  renderBannerLines(bannerLines);
  if (shouldAnimateBanner()) {
    await renderAnimatedBinary(wrappedBinary);
    await renderAnimatedBannerText(bannerLines, wrappedBinary);
  } else {
    renderBinaryLines(wrappedBinary);
  }
  console.log();
}

export function printSuccess(message: string): void {
  console.log(COLORS.green + `${DOT} ` + message + COLORS.reset);
}

export function printInfo(message: string): void {
  console.log(COLORS.cyan + `${DOT} ` + message + COLORS.reset);
}

export function printWarning(message: string): void {
  console.log(COLORS.yellow + `${DOT} ` + message + COLORS.reset);
}

export function printError(message: string): void {
  console.error(COLORS.red + `${DOT} ` + message + COLORS.reset);
}

export function printEmptyLine(): void {
  console.log();
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
    {
      cmd: "cr init",
      desc: "Initialize configuration. Use --sdd or --webhook for specific setups.",
    },
    { cmd: "cr config", desc: "View or edit complete configuration." },
    { cmd: "cr review", desc: "Run review, summarize, or chat workflows." },
    { cmd: "cr create-review", desc: "Generate or update a merge request or review request draft." },
    { cmd: "cr serve", desc: "Start a webhook server for GitLab or Review Board events." },
    { cmd: "cr help", desc: "Show this help screen." },
  ]);

  const workflowRows = formatHelpRows([
    { cmd: "cr review --workflow default", desc: "Code review for a merge request." },
    { cmd: "cr review --workflow summarize", desc: "Summary of merge request changes." },
    { cmd: "cr review --workflow chat", desc: "Interactive Q&A over MR context." },
  ]);

  const exampleRows = [
    "cr review --path .",
    "cr review --workflow summarize --path .",
    "cr create-review --target-branch main",
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


