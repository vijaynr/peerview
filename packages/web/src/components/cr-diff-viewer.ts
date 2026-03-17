import { LitElement, css, html } from "lit";
import { parseUnifiedDiff } from "../diff.js";
import { dashboardThemeStyles } from "../styles.js";
import type { ParsedDiffLine, ReviewDiffFile } from "../types.js";

export class CrDiffViewer extends LitElement {
  static properties = {
    files: { attribute: false },
    selectedFileId: {},
    selectedPatch: {},
    selectedLineKey: {},
    loading: { type: Boolean },
    error: {},
  };

  static styles = [
    dashboardThemeStyles,
    css`
      :host {
        display: block;
        min-height: 0;
      }

      .shell {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        min-height: 0;
        border-radius: 24px;
        overflow: hidden;
        border: 1px solid var(--line);
        background: var(--surface);
      }

      .files {
        display: grid;
        align-content: start;
        gap: 8px;
        padding: 18px;
        background: var(--panel-muted);
        border-right: 1px solid var(--line);
        overflow: auto;
      }

      .file {
        display: grid;
        gap: 6px;
        width: 100%;
        padding: 12px;
        border-radius: 14px;
        border: 1px solid transparent;
        background: transparent;
        text-align: left;
        color: var(--ink);
        cursor: pointer;
      }

      .file[data-active="true"] {
        border-color: rgba(217, 118, 18, 0.22);
        background: rgba(255, 247, 237, 0.95);
      }

      .viewer {
        display: grid;
        min-height: 0;
      }

      .empty,
      .error {
        padding: 18px;
        color: var(--ink-soft);
      }

      .error {
        color: var(--danger);
      }

      .code {
        display: grid;
        align-content: start;
        overflow: auto;
        background:
          linear-gradient(180deg, rgba(246, 241, 232, 0.55), rgba(255, 255, 255, 0.92)),
          white;
      }

      .line {
        display: grid;
        grid-template-columns: 56px 56px 1fr auto;
        gap: 12px;
        align-items: start;
        padding: 0 16px;
        border-bottom: 1px solid rgba(215, 205, 191, 0.45);
        color: var(--ink);
        font-size: 0.88rem;
        line-height: 1.6;
      }

      .line[data-kind="add"] {
        background: rgba(44, 106, 83, 0.08);
      }

      .line[data-kind="remove"] {
        background: rgba(154, 65, 50, 0.08);
      }

      .line[data-kind="header"] {
        background: rgba(231, 232, 229, 0.75);
        color: var(--ink-soft);
      }

      .line[data-active="true"] {
        outline: 1px solid rgba(217, 118, 18, 0.35);
        outline-offset: -1px;
      }

      .numbers {
        padding: 8px 0;
        color: var(--ink-faint);
        text-align: right;
      }

      pre {
        margin: 0;
        padding: 8px 0;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .comment {
        margin: 6px 0;
        min-height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--ink-soft);
        cursor: pointer;
      }

      .comment:hover {
        border-color: var(--line);
        background: rgba(255, 255, 255, 0.72);
      }

      @media (max-width: 980px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .files {
          grid-auto-flow: column;
          grid-auto-columns: minmax(220px, 1fr);
          overflow: auto;
          border-right: none;
          border-bottom: 1px solid var(--line);
        }
      }
    `,
  ];

  declare files: ReviewDiffFile[];
  declare selectedFileId: string;
  declare selectedPatch: string;
  declare selectedLineKey: string;
  declare loading: boolean;
  declare error: string;

  constructor() {
    super();
    this.files = [];
    this.selectedFileId = "";
    this.selectedPatch = "";
    this.selectedLineKey = "";
    this.loading = false;
    this.error = "";
  }

  private chooseFile(file: ReviewDiffFile) {
    this.dispatchEvent(
      new CustomEvent("file-selected", {
        detail: file,
        bubbles: true,
        composed: true,
      })
    );
  }

  private chooseLine(file: ReviewDiffFile, line: ParsedDiffLine) {
    if (!line.commentable || !line.positionType) {
      return;
    }

    const targetLine =
      line.positionType === "old" ? line.oldLineNumber : line.newLineNumber;
    if (!targetLine) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent("line-selected", {
        detail: {
          filePath: file.path,
          line: targetLine,
          positionType: line.positionType,
          text: line.text,
          key: `${file.path}:${line.positionType}:${targetLine}`,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const selectedFile = this.files.find((file) => file.id === this.selectedFileId) ?? this.files[0];
    const parsedLines = parseUnifiedDiff(this.selectedPatch);

    return html`
      <section class="shell">
        <div class="files">
          ${this.files.map(
            (file) => html`
              <button
                class="file"
                data-active=${String(file.id === this.selectedFileId)}
                type="button"
                @click=${() => this.chooseFile(file)}
              >
                <strong>${file.path}</strong>
                <span class="subtle">${file.status || "modified"}</span>
              </button>
            `
          )}
        </div>

        <div class="viewer">
          ${this.loading
            ? html`<div class="empty">Loading diff…</div>`
            : this.error
              ? html`<div class="error">${this.error}</div>`
              : !selectedFile
                ? html`<div class="empty">Pick a file to inspect its patch.</div>`
                : parsedLines.length === 0
                  ? html`<div class="empty">No textual patch is available for this file.</div>`
                  : html`
                      <div class="code">
                        ${parsedLines.map(
                          (line) => html`
                            <div
                              class="line mono"
                              data-kind=${line.kind}
                              data-active=${String(
                                selectedFile && this.selectedLineKey === this.lineKey(selectedFile, line)
                              )}
                            >
                              <div class="numbers">${line.oldLineNumber ?? ""}</div>
                              <div class="numbers">${line.newLineNumber ?? ""}</div>
                              <pre>${line.text}</pre>
                              ${line.commentable
                                ? html`
                                    <button class="comment" type="button" @click=${() => this.chooseLine(selectedFile, line)}>
                                      Comment
                                    </button>
                                  `
                                : html`<div></div>`}
                            </div>
                          `
                        )}
                      </div>
                    `}
        </div>
      </section>
    `;
  }

  private lineKey(file: ReviewDiffFile, line: ParsedDiffLine): string {
    const lineNumber = line.positionType === "old" ? line.oldLineNumber : line.newLineNumber;
    return `${file.path}:${line.positionType ?? "new"}:${lineNumber ?? 0}`;
  }
}

customElements.define("cr-diff-viewer", CrDiffViewer);
