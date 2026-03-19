import { LitElement, html, type PropertyValues } from "lit";
import {
  ChevronDown,
  ChevronRight,
  FileDiff,
  MessageSquareMore,
} from "lucide";
import { parse } from "diff2html";
import type {
  DiffBlock,
  DiffFile as ParsedDiffFile,
  DiffLine,
} from "diff2html/lib-esm/types";
import type { ReviewDiffFile } from "../types.js";
import "./cr-icon.js";

type InlineTarget = {
  filePath: string;
  line: number;
  positionType: "new" | "old";
  text: string;
  key: string;
};

type BlockEnd = {
  oldLine: number;
  newLine: number;
};

function sameIds(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export class CrDiffViewer extends LitElement {
  static properties = {
    files: { attribute: false },
    selectedFileId: {},
    selectedLineKey: {},
    loading: { type: Boolean },
    error: {},
    expandedFileIds: { state: true },
  };

  override createRenderRoot() {
    return this;
  }

  declare files: ReviewDiffFile[];
  declare selectedFileId: string;
  declare selectedLineKey: string;
  declare loading: boolean;
  declare error: string;
  declare expandedFileIds: string[];

  constructor() {
    super();
    this.files = [];
    this.selectedFileId = "";
    this.selectedLineKey = "";
    this.loading = false;
    this.error = "";
    this.expandedFileIds = [];
  }

  protected override willUpdate(changedProperties: PropertyValues<this>) {
    if (
      !changedProperties.has("files") &&
      !changedProperties.has("selectedFileId")
    ) {
      return;
    }

    const availableIds = new Set(this.files.map((file) => file.id));
    const preferredFileId = this.selectedFileId || this.files[0]?.id;
    const nextExpanded = preferredFileId && availableIds.has(preferredFileId)
      ? [preferredFileId]
      : [];

    if (!sameIds(nextExpanded, this.expandedFileIds)) {
      this.expandedFileIds = nextExpanded;
    }
  }

  private chooseFile(file: ReviewDiffFile) {
    this.dispatchEvent(
      new CustomEvent("file-selected", {
        detail: file,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private chooseLine(target: InlineTarget) {
    this.dispatchEvent(
      new CustomEvent("line-selected", {
        detail: target,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleFileToggle(file: ReviewDiffFile, event: Event) {
    const isOpen = (event.currentTarget as HTMLDetailsElement).open;

    if (isOpen) {
      this.expandedFileIds = [file.id];
      this.chooseFile(file);
      return;
    }

    this.expandedFileIds = [];
  }

  private isExpanded(fileId: string) {
    return this.expandedFileIds.includes(fileId);
  }

  private parseFile(file: ReviewDiffFile): ParsedDiffFile | null {
    if (!file.patch?.trim()) {
      return null;
    }

    try {
      return parse(this.buildUnifiedDiff(file))[0] ?? null;
    } catch {
      return null;
    }
  }

  private buildUnifiedDiff(file: ReviewDiffFile) {
    const patch = file.patch?.trimEnd() ?? "";
    if (!patch) {
      return "";
    }

    if (
      patch.startsWith("diff --git") ||
      patch.startsWith("--- ") ||
      patch.startsWith("Index: ")
    ) {
      return patch;
    }

    const oldPath = file.oldPath ?? file.path;
    const oldHeader =
      file.status === "added" ? "/dev/null" : `a/${oldPath}`;
    const newHeader =
      file.status === "deleted" ? "/dev/null" : `b/${file.path}`;

    return [
      `diff --git a/${oldPath} b/${file.path}`,
      `--- ${oldHeader}`,
      `+++ ${newHeader}`,
      patch,
    ].join("\n");
  }

  private lineMarker(line: DiffLine) {
    if (line.type === "insert") {
      return "+";
    }

    if (line.type === "delete") {
      return "-";
    }

    return " ";
  }

  private lineContent(line: DiffLine) {
    return line.content.length > 0 ? line.content.slice(1) : "";
  }

  private inlineTargetForLine(
    file: ReviewDiffFile,
    line: DiffLine,
  ): InlineTarget | null {
    if (line.type === "delete" && line.oldNumber !== undefined) {
      return {
        filePath: file.path,
        line: line.oldNumber,
        positionType: "old",
        text: this.lineContent(line),
        key: `${file.path}:old:${line.oldNumber}`,
      };
    }

    if (line.newNumber !== undefined) {
      return {
        filePath: file.path,
        line: line.newNumber,
        positionType: "new",
        text: this.lineContent(line),
        key: `${file.path}:new:${line.newNumber}`,
      };
    }

    return null;
  }

  private blockEnd(block: DiffBlock): BlockEnd {
    let oldLine = block.oldStartLine - 1;
    let newLine = block.newStartLine - 1;

    for (const line of block.lines) {
      if (line.oldNumber !== undefined) {
        oldLine = line.oldNumber;
      }
      if (line.newNumber !== undefined) {
        newLine = line.newNumber;
      }
    }

    return { oldLine, newLine };
  }

  private omittedLineCount(
    previousBlock: DiffBlock,
    nextBlock: DiffBlock,
  ) {
    const previousEnd = this.blockEnd(previousBlock);
    const oldGap = Math.max(nextBlock.oldStartLine - previousEnd.oldLine - 1, 0);
    const newGap = Math.max(nextBlock.newStartLine - previousEnd.newLine - 1, 0);
    return Math.max(oldGap, newGap);
  }

  private renderLine(
    file: ReviewDiffFile,
    line: DiffLine,
    parsedFile: ParsedDiffFile,
  ) {
    const target = this.inlineTargetForLine(file, line);
    const isActive = target?.key === this.selectedLineKey;
    const rowKind =
      line.type === "insert"
        ? "insert"
        : line.type === "delete"
          ? "delete"
          : "context";

    return html`
      <div
        class="cr-diff-viewer__row"
        data-kind=${rowKind}
        data-active=${String(isActive)}
      >
        <span class="cr-diff-viewer__line-number">${line.oldNumber ?? ""}</span>
        <span class="cr-diff-viewer__line-number">${line.newNumber ?? ""}</span>
        <span class="cr-diff-viewer__marker" data-kind=${rowKind}>
          ${this.lineMarker(line)}
        </span>
        <pre class="cr-diff-viewer__content">${this.lineContent(line)}</pre>
        ${target
          ? html`
              <button
                class="btn btn-ghost btn-xs cr-diff-viewer__comment-button"
                type="button"
                @click=${() => this.chooseLine(target)}
                aria-label=${`Comment on ${parsedFile.newName || file.path} line ${target.line}`}
              >
                <cr-icon .icon=${MessageSquareMore} .size=${12}></cr-icon>
              </button>
            `
          : html`<span></span>`}
      </div>
    `;
  }

  private renderBlock(
    file: ReviewDiffFile,
    parsedFile: ParsedDiffFile,
    block: DiffBlock,
    blockIndex: number,
    blocks: DiffBlock[],
  ) {
    const omittedLines =
      blockIndex > 0
        ? this.omittedLineCount(blocks[blockIndex - 1], block)
        : 0;

    return html`
      ${omittedLines > 0
        ? html`
            <div class="cr-diff-viewer__gap">
              ${omittedLines} unmodified line${omittedLines === 1 ? "" : "s"}
            </div>
          `
        : ""}
      <div class="cr-diff-viewer__row" data-kind="header">
        <span class="cr-diff-viewer__line-number"></span>
        <span class="cr-diff-viewer__line-number"></span>
        <span class="cr-diff-viewer__marker" data-kind="header">@</span>
        <pre class="cr-diff-viewer__content">${block.header}</pre>
        <span></span>
      </div>
      ${block.lines.map((line) => this.renderLine(file, line, parsedFile))}
    `;
  }

  private renderDiffBody(file: ReviewDiffFile) {
    const parsedFile = this.parseFile(file);
    const isLoadingFile = this.loading && this.selectedFileId === file.id && !file.patch;

    if (isLoadingFile) {
      return html`
        <div class="cr-diff-viewer__empty">
          <span class="loading loading-spinner loading-sm"></span>
          Loading patch…
        </div>
      `;
    }

    if (!file.patch?.trim()) {
      return html`
        <div class="cr-diff-viewer__empty">
          No textual patch is available for this file yet.
        </div>
      `;
    }

    if (!parsedFile || parsedFile.blocks.length === 0) {
      return html`
        <div class="cr-diff-viewer__empty">
          Unable to render this patch with the current viewer.
        </div>
      `;
    }

    return html`
      <div class="cr-diff-viewer__code-scroll">
        <div class="cr-diff-viewer__code">
          ${parsedFile.blocks.map((block, index, blocks) =>
            this.renderBlock(file, parsedFile, block, index, blocks),
          )}
        </div>
      </div>
    `;
  }

  private renderFile(file: ReviewDiffFile) {
    const isOpen = this.isExpanded(file.id);
    const isActive = this.selectedFileId === file.id;
    const additions = file.additions ?? 0;
    const deletions = file.deletions ?? 0;

    return html`
      <details
        class="cr-diff-viewer__file"
        ?open=${isOpen}
        @toggle=${(event: Event) => this.handleFileToggle(file, event)}
      >
        <summary
          class="cr-diff-viewer__file-summary"
          data-active=${String(isActive)}
        >
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-base-content/45 shrink-0">
              <cr-icon
                .icon=${isOpen ? ChevronDown : ChevronRight}
                .size=${14}
              ></cr-icon>
            </span>
            <span class="text-base-content/55 shrink-0">
              <cr-icon .icon=${FileDiff} .size=${14}></cr-icon>
            </span>
            <div class="min-w-0 flex flex-col">
              <span class="font-mono text-xs text-base-content/90 truncate">
                ${file.path}
              </span>
              ${file.oldPath && file.oldPath !== file.path
                ? html`
                    <span class="font-mono text-[10px] text-base-content/45 truncate">
                      from ${file.oldPath}
                    </span>
                  `
                : html``}
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0 pl-3">
            <span class="font-mono text-xs text-success">+${additions}</span>
            <span class="font-mono text-xs text-error">-${deletions}</span>
          </div>
        </summary>
        <div class="cr-diff-viewer__file-body">
          ${this.renderDiffBody(file)}
        </div>
      </details>
    `;
  }

  render() {
    if (this.error) {
      return html`
        <div class="cr-diff-viewer__empty text-error">${this.error}</div>
      `;
    }

    if (this.files.length === 0) {
      return html`
        <div class="cr-diff-viewer__empty text-base-content/50">
          No diff files are available for this review target.
        </div>
      `;
    }

    return html`
      <div class="cr-diff-viewer">
        ${this.files.map((file) => this.renderFile(file))}
      </div>
    `;
  }
}

customElements.define("cr-diff-viewer", CrDiffViewer);
