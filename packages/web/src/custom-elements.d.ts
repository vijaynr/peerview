import type { CrToastNotification } from "./components/cr-toast-notification.js";
import type { CrThemeToggle } from "./components/cr-theme-toggle.js";
import type { CrConfigInput } from "./components/cr-config-input.js";
import type { CrProviderSummaryCard } from "./components/cr-provider-summary-card.js";
import type { CrSidebarNav } from "./components/cr-sidebar-nav.js";
import type { CrOverviewPage } from "./components/cr-overview-page.js";
import type { CrCommitsList } from "./components/cr-commits-list.js";
import type { CrDiscussionThread } from "./components/cr-discussion-thread.js";
import type { CrInlineCommentPopover } from "./components/cr-inline-comment-popover.js";
import type { CrReviewPanel } from "./components/cr-review-panel.js";
import type { CrSummaryPanel } from "./components/cr-summary-panel.js";
import type { CrChatPanel } from "./components/cr-chat-panel.js";
import type { CrCommentsWorkspace } from "./components/cr-comments-workspace.js";
import type { CrQueueRail } from "./components/cr-queue-rail.js";
import type { CrWorkspacePanel } from "./components/cr-workspace-panel.js";
import type { CrAnalysisRail } from "./components/cr-analysis-rail.js";
import type { CrProviderPage } from "./components/cr-provider-page.js";
import type { CrSettingsPage } from "./components/cr-settings-page.js";
import type { CrDashboardApp } from "./components/cr-dashboard-app.js";

declare global {
  interface HTMLElementTagNameMap {
    "cr-toast-notification": CrToastNotification;
    "cr-theme-toggle": CrThemeToggle;
    "cr-config-input": CrConfigInput;
    "cr-provider-summary-card": CrProviderSummaryCard;
    "cr-sidebar-nav": CrSidebarNav;
    "cr-overview-page": CrOverviewPage;
    "cr-commits-list": CrCommitsList;
    "cr-discussion-thread": CrDiscussionThread;
    "cr-inline-comment-popover": CrInlineCommentPopover;
    "cr-review-panel": CrReviewPanel;
    "cr-summary-panel": CrSummaryPanel;
    "cr-chat-panel": CrChatPanel;
    "cr-comments-workspace": CrCommentsWorkspace;
    "cr-queue-rail": CrQueueRail;
    "cr-workspace-panel": CrWorkspacePanel;
    "cr-analysis-rail": CrAnalysisRail;
    "cr-provider-page": CrProviderPage;
    "cr-settings-page": CrSettingsPage;
    "cr-dashboard-app": CrDashboardApp;
  }
}
