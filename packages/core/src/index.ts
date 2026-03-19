// types

export { createGitHubClient, GitHubClient } from "./clients/githubClient.js";
// clients (GitLabClient/LlmClient interfaces and factories not in utils barrel)
export { createGitLabClient, GitLabClient } from "./clients/gitlabClient.js";
export type { LlmClient } from "./clients/llmClient.js";
export { createLlmClient } from "./clients/llmClient.js";
export type { ReviewBoardClient } from "./clients/reviewBoardClient.js";
export { createReviewBoardClient } from "./clients/reviewBoardClient.js";
export type { SvnClient } from "./clients/svnClient.js";
export { createSvnClient } from "./clients/svnClient.js";
// resources
export * from "./resources/index.js";
// extra types not covered by types/index.ts barrel
export { defaultConfig } from "./types/config.js";
export * from "./types/index.js";
export type {
  CreateMrDraft,
  CreateMrWorkflowEffect,
  CreateMrWorkflowInput,
  CreateMrWorkflowResponse,
  CreateMrWorkflowResult,
  CreateReviewDraft,
  CreateReviewProvider,
  CreateReviewWorkflowEffect,
  CreateReviewWorkflowInput,
  CreateReviewWorkflowResponse,
  CreateReviewWorkflowResult,
  ReviewAgentSelectionOption,
  ReviewSelectionOption,
  ReviewSessionEffect,
  ReviewSessionResponse,
  ReviewSessionResult,
  ReviewWorkflowEffect,
  ReviewWorkflowResponse,
  StatusLevel,
  StatusReporter,
  WorkflowEventReporter,
  WorkflowKind,
  WorkflowName,
  WorkflowPhaseMap,
  WorkflowUiEvent,
} from "./types/workflows.js";
export type {
  DashboardConfigSummary,
  DashboardData,
  DashboardProviderData,
  DashboardProviderName,
  DashboardRepositorySummary,
  DashboardReviewRequest,
} from "./types/web.js";
// utils
export * from "./utils/index.js";
// explicit utils re-exports for Bun's static named export resolution
export {
  addGitHubInlinePullRequestComment,
  addGitHubPullRequestComment,
  addInlineMergeRequestComment,
  addMergeRequestComment,
  CR_CONF_PATH,
  compareBranches,
  compareGitHubBranches,
  createGitHubPullRequest,
  createMergeRequest,
  createRuntimeGitHubClient,
  createRuntimeGitLabClient,
  createRuntimeLlmClient,
  createRuntimeSvnClient,
  DEFAULT_REVIEW_AGENT_NAME,
  detectGitProvider,
  envOrConfig,
  findExistingGitHubPullRequest,
  findExistingMergeRequest,
  findOpenGitHubPullRequestByHead,
  findOpenMergeRequestBySourceBranch,
  generateTextWithLlm,
  getCurrentBranch,
  getGitHubDefaultBranch,
  getGitHubFileContent,
  listGitHubIssueComments,
  getGitHubPullRequest,
  getGitHubPullRequestCommits,
  getGitHubPullRequestFiles,
  getMergeRequest,
  getMergeRequestChanges,
  getMergeRequestCommits,
  getMergeRequestInlineComments,
  listGitHubReviewComments,
  getOriginRemoteUrl,
  getSvnDiff,
  getSvnRepoRootUrl,
  getSvnWorkingCopyRoot,
  getSvnWorkingCopyUrl,
  githubBranchExists,
  initializeCRHome,
  isGitHubRemote,
  isSvnWorkingCopy,
  listBranches,
  listGitHubRepositories,
  listBundledReviewAgentNames,
  loadDashboardData,
  listGitHubBranches,
  listGitHubPullRequests,
  listGitLabProjects,
  listMergeRequests,
  listMergeRequestDiscussions,
  loadCRConfig,
  loadGitHubRepositoryGuidelines,
  loadGitLabRepositoryGuidelines,
  loadLocalRepositoryGuidelines,
  loadPrompt,
  loadReviewAgentPrompt,
  loadSvnRepositoryGuidelines,
  loadWorkflowRuntime,
  logger,
  normalizeReviewAgentNames,
  readCRConfigContents,
  remoteToGitHubRepoPath,
  remoteToProjectPath,
  repoRootFromModule,
  replyToGitHubReviewComment,
  replyToMergeRequestDiscussion,
  resolveSvnFileUrl,
  saveCRConfig,
  setupRpi,
  setupSpecs,
  svnGetFile,
  updateGitHubPullRequest,
  updateMergeRequest,
} from "./utils/index.js";
export {
  CR_ASSETS_DIR,
  CR_DIR,
  CR_LOGS_DIR,
  CR_PROMPTS_DIR,
  HOME_DIR,
  resourcesPathFromRepoRoot,
} from "./utils/paths.js";
export {
  addDiffComment,
  createReview,
  createReviewRequest,
  getCurrentUser,
  getFileDiffData,
  getFileDiffs,
  getLatestDiffSet,
  getReviewRequest,
  listRepositories,
  listReviewRequests,
  publishReview,
  publishReviewRequest,
  rbRequest,
  reviewBoardToRequestId,
  updateReviewRequestDraft,
  uploadReviewRequestDiff,
} from "./utils/reviewBoard.js";
export type { ConditionalRoute, WorkflowStep } from "./utils/workflow.js";
// extra utils not covered by utils barrel
export { runSequentialWorkflow, runWorkflow } from "./utils/workflow.js";
export { createRuntimeReviewBoardClient } from "./utils/workflowRuntime.js";
