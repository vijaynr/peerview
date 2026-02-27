// Utility function exports
export { assert } from "./assertions.js";
export { formatKnownNetworkError, type FormattedError } from "./errors.js";
export { parseCRSseStream } from "./stream-parser.js";

// Configuration exports
export { loadCRConfig, saveCRConfig, envOrConfig } from "./config.js";
export { repoRootFromModule, CR_CONF_PATH } from "./paths.js";

// Git exports
export { getOriginRemoteUrl, getCurrentBranch } from "./git.js";

// GitLab exports
export {
  remoteToProjectPath,
  listBranches,
  listMergeRequests,
  findOpenMergeRequestBySourceBranch,
  getMergeRequest,
  getMergeRequestChanges,
  getMergeRequestCommits,
  addMergeRequestComment,
  getMergeRequestInlineComments,
  addInlineMergeRequestComment,
  compareBranches,
  findExistingMergeRequest,
  createMergeRequest,
  updateMergeRequest,
  type GitLabInlineComment,
} from "./gitlab.js";

// LLM exports
export { generateTextWithLlm } from "./llm.js";

// Markdown exports
export { renderMarkdownForTerminal } from "./markdown.js";

// Prompts exports
export { loadPrompt } from "./prompts.js";

// Spinner exports
export { createSpinner } from "./spinner.js";

// Bootstrap exports
export { initializeCRHome } from "./bootstrap.js";

// Workflow runtime exports
export {
  loadWorkflowRuntime,
  createRuntimeLlmClient,
  createRuntimeGitLabClient,
  type WorkflowRuntime,
} from "./workflow-runtime.js";

// Workflow events exports
export { createWorkflowPhaseReporter } from "./workflow-events.js";

// Review command utilities
export {
  getWorkflowHeadingAndDescription,
  getWorkflowResultTitle,
  buildCreateMrResultBody,
  hasFlag,
  getFlag,
  readStdinDiff,
  type ReviewWorkflowKind,
} from "./review-command.js";

// Review workflow helpers
export {
  injectMergeRequestContextIntoTemplate,
  buildChatPrompt,
  extractJsonObject,
  parseDiffHunks,
  resolveInlinePosition,
} from "./review-workflow-helpers.js";
