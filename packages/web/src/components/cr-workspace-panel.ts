import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  ArrowUpRight,
  FileDiff,
  FolderSearch,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  type IconNode,
} from "lucide";
import type {
  ProviderId,
  ProviderRepositoryOption,
  ReviewCommit,
  ReviewDiffFile,
  ReviewDiscussionThread,
  ReviewTarget,
  ReviewWorkflowResult,
} from "../types.js";
import "./cr-icon.js";
import "./cr-diff-viewer.js";
import "./cr-inline-comment-popover.js";
import "./cr-comments-workspace.js";
import "./cr-commits-list.js";
import { renderMarkdown } from "./render-markdown.js";

type WorkspaceTab = "overview" | "diff" | "commits" | "comments";

type SelectedInlineTarget = {
  filePath: string;
  line: number;
  positionType: "new" | "old";
  text: string;
  key: string;
};

@customElement("cr-workspace-panel")
export class CrWorkspacePanel extends LitElement {
  @property() provider: ProviderId = "gitlab";
  @property({ attribute: false }) detailTarget: ReviewTarget | null = null;
  @property({ attribute: false }) diffFiles: ReviewDiffFile[] = [];
  @property({ attribute: false }) commits: ReviewCommit[] = [];
  @property() selectedFileId = "";
  @property() selectedFilePatch = "";
  @property({ attribute: false }) selectedLine: SelectedInlineTarget | null = null;
  @property() workspaceTab: WorkspaceTab = "diff";
  @property({ type: Boolean }) loadingDetail = false;
  @property({ type: Boolean }) loadingDiffPatch = false;
  @property() detailError = "";
  @property({ attribute: false }) selectedRepository: ProviderRepositoryOption | null = null;
  @property({ attribute: false }) discussions: ReviewDiscussionThread[] = [];
  @property({ type: Boolean }) loadingDiscussions = false;
  @property() discussionsError = "";
  @property() replyingToThreadId = "";
  @property() discussionReplyDraft = "";
  @property({ type: Boolean }) postingDiscussionReply = false;
  @property() summaryDraft = "";
  @property({ type: Boolean }) postingSummary = false;
  @property({ attribute: false }) reviewResult: ReviewWorkflowResult | null = null;
  @property({ attribute: false }) summaryResult: ReviewWorkflowResult | null = null;
  @property() inlineDraft = "";
  @property({ type: Boolean }) postingInline = false;

  override createRenderRoot() {
    return this;
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  private formatLabel(value: string) {
    const n = value.replace(/[_-]+/g, " ").trim();
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
  }

  private iconForWorkspaceTab(tab: WorkspaceTab): IconNode {
    switch (tab) {
      case "overview": return LayoutDashboard;
      case "diff": return FileDiff;
      case "commits": return GitBranch;
      case "comments": return MessageSquare;
    }
  }

  render() {
    const detail = this.detailTarget;

    return html`
      <section class="cr-review-workspace-panel relative rounded-[0.55rem] border border-base-300 bg-base-200 p-4">
        ${detail
          ? this.renderContent(detail)
          : this.selectedRepository
            ? html`
                <div class="flex flex-1 items-center justify-center">
                  <div class="cr-empty-state">
                    <div class="cr-empty-state__icon"><cr-icon .icon=${FolderSearch} .size=${32}></cr-icon></div>
                    <div class="cr-empty-state__title">No review request selected</div>
                    <div class="cr-empty-state__description">Choose a review item from the queue on the left to open the workspace.</div>
                  </div>
                </div>
              `
            : html`
                <div class="flex flex-1 items-center justify-center">
                  <div class="cr-empty-state">
                    <div class="cr-empty-state__icon"><cr-icon .icon=${FolderSearch} .size=${32}></cr-icon></div>
                    <div class="cr-empty-state__title">Select a repository</div>
                    <div class="cr-empty-state__description">Choose a repository in the selector above to load review items and open the workspace.</div>
                  </div>
                </div>
              `}
      </section>
    `;
  }

  private renderContent(detail: ReviewTarget) {
    return html`
      <div class="flex items-start justify-between gap-2 flex-wrap">
        <div class="flex min-w-0 flex-col gap-1">
          <h2 class="text-base font-semibold leading-snug">
            <span class="font-mono text-primary text-sm">
              ${detail.provider === "gitlab" ? `!${detail.id}` : `#${detail.id}`}
            </span>
            ${detail.title}
          </h2>
          <div class="mt-1 flex flex-wrap gap-1.5">
            ${detail.state ? html`<span class="badge badge-sm badge-ghost">${this.formatLabel(detail.state)}</span>` : ""}
            ${detail.author ? html`<span class="badge badge-sm badge-ghost">${detail.author}</span>` : ""}
            ${detail.sourceBranch ? html`<span class="badge badge-sm badge-ghost font-mono">${detail.sourceBranch}${detail.targetBranch ? ` → ${detail.targetBranch}` : ""}</span>` : ""}
            ${detail.updatedAt ? html`<span class="badge badge-sm badge-ghost">${detail.updatedAt}</span>` : ""}
          </div>
        </div>
        ${detail.url ? html`<a class="btn btn-ghost btn-xs shrink-0 gap-1.5" href=${detail.url} target="_blank" rel="noreferrer"><cr-icon .icon=${ArrowUpRight} .size=${12}></cr-icon>Open</a>` : ""}
      </div>

      <div class="tabs tabs-boxed cr-tab-strip cr-tab-strip--inline self-start">
        ${(["overview", "diff", "commits", "comments"] as WorkspaceTab[]).map(
          (tab) => html`
            <button
              type="button"
              class="tab tab-sm cr-tab ${this.workspaceTab === tab ? "tab-active" : ""} gap-1.5"
              @click=${() => this.emit("workspace-tab-change", tab)}
            >
              <cr-icon .icon=${this.iconForWorkspaceTab(tab)} .size=${13}></cr-icon>
              ${this.formatLabel(tab)}
            </button>
          `
        )}
      </div>

      <div class="relative flex-1 min-h-0 overflow-hidden">
        ${this.detailError
          ? html`<div class="alert alert-error text-sm">${this.detailError}</div>`
          : this.loadingDetail
            ? html`
                <div class="cr-loader-shell">
                  <span class="loading loading-spinner loading-sm text-primary"></span>
                  <span class="text-sm text-base-content/50">Loading workspace…</span>
                </div>
              `
            : this.workspaceTab === "overview"
              ? html`<div class="h-full overflow-auto pr-1">${this.renderOverview(detail)}</div>`
              : this.workspaceTab === "comments"
                ? html`
                    <cr-comments-workspace
                      .detail=${detail}
                      .reviewResult=${this.reviewResult}
                      .summaryResult=${this.summaryResult}
                      .summaryDraft=${this.summaryDraft}
                      .postingSummary=${this.postingSummary}
                      .discussions=${this.discussions}
                      .loadingDiscussions=${this.loadingDiscussions}
                      .discussionsError=${this.discussionsError}
                      .replyingToThreadId=${this.replyingToThreadId}
                      .discussionReplyDraft=${this.discussionReplyDraft}
                      .postingDiscussionReply=${this.postingDiscussionReply}
                    ></cr-comments-workspace>
                  `
                : this.workspaceTab === "commits"
                  ? html`<div class="h-full overflow-auto pr-1"><cr-commits-list .commits=${this.commits}></cr-commits-list></div>`
                  : html`
                      <div class="relative h-full min-h-0">
                        <cr-diff-viewer
                          .files=${this.diffFiles}
                          .selectedFileId=${this.selectedFileId}
                          .selectedLineKey=${this.selectedLine?.key || ""}
                          .loading=${this.loadingDiffPatch}
                          .error=${this.detailError}
                          @file-selected=${(e: CustomEvent<ReviewDiffFile>) => this.emit("file-selected", e.detail)}
                          @line-selected=${(e: CustomEvent) => this.emit("line-selected", e.detail)}
                        ></cr-diff-viewer>
                        <cr-inline-comment-popover
                          .selectedLine=${this.selectedLine}
                          .inlineDraft=${this.inlineDraft}
                          .postingInline=${this.postingInline}
                          .isReviewBoard=${this.provider === "reviewboard"}
                        ></cr-inline-comment-popover>
                      </div>
                    `}
      </div>
    `;
  }

  private renderOverview(detail: ReviewTarget) {
    return html`
      <div class="flex flex-col gap-4 min-h-0">
        <div class="rounded-[0.55rem] border border-base-100/10 bg-base-300 px-4 py-4 flex flex-col gap-3">
          <h3 class="text-sm font-semibold">Description</h3>
          ${renderMarkdown(detail.description || detail.summary, {
            className: "text-sm text-base-content/70",
            emptyText: "No rich description from the provider. Use the diff and commit tabs for full review context.",
          })}
        </div>
      </div>
    `;
  }
}
