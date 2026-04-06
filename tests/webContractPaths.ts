import { fileURLToPath } from "node:url";

const resolveWebSourcePath = (relativePath: string) =>
  fileURLToPath(new URL(`../packages/web/src/${relativePath}`, import.meta.url));

export const analysisRailPath = resolveWebSourcePath("components/cr-analysis-rail.ts");
export const chatPanelPath = resolveWebSourcePath("components/cr-chat-panel.ts");
export const dashboardAppPath = resolveWebSourcePath("components/cr-dashboard-app.ts");
export const diffViewerPath = resolveWebSourcePath("components/cr-diff-viewer.ts");
export const discussionThreadPath = resolveWebSourcePath("components/cr-discussion-thread.ts");
export const indexPath = resolveWebSourcePath("index.ts");
export const popoverPath = resolveWebSourcePath("components/cr-inline-comment-popover.ts");
export const providerIconPath = resolveWebSourcePath("components/cr-provider-icon.ts");
export const providerPagePath = resolveWebSourcePath("components/cr-provider-page.ts");
export const providerSummaryPath = resolveWebSourcePath("components/cr-provider-summary-card.ts");
export const reviewPanelPath = resolveWebSourcePath("components/cr-review-panel.ts");
export const sidebarPath = resolveWebSourcePath("components/cr-sidebar-nav.ts");
export const stylesPath = resolveWebSourcePath("styles.css");
export const summaryPanelPath = resolveWebSourcePath("components/cr-summary-panel.ts");
export const themeTogglePath = resolveWebSourcePath("components/cr-theme-toggle.ts");
export const workspacePanelPath = resolveWebSourcePath("components/cr-workspace-panel.ts");
