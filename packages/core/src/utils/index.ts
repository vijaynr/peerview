// Utility function exports
export { assert } from "./assertions.js";
export { formatKnownNetworkError, type FormattedError } from "./errors.js";
export { parseCRSseStream } from "./streamParser.js";
export { logger, type LogLevel } from "./logger.js";

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
  compareBranches,
  findExistingMergeRequest,
  createMergeRequest,
  updateMergeRequest,
  type GitLabInlineComment,
} from "./gitlab.js";
export {
  addMergeRequestComment,
  getMergeRequestInlineComments,
  addInlineMergeRequestComment,
} from "./gitlabComments.js";

// LLM exports
export { generateTextWithLlm } from "./llm.js";

// Prompts exports
export { loadPrompt } from "./promptsManager.js";
export {
  loadLocalRepositoryGuidelines,
  loadGitLabRepositoryGuidelines,
  loadSvnRepositoryGuidelines,
} from "./repositoryGuidelines.js";
export { svnGetFile, resolveSvnFileUrl } from "./svn.js";
export {
  isSvnWorkingCopy,
  getSvnDiff,
  getSvnRepoRootUrl,
  getSvnWorkingCopyUrl,
  getSvnWorkingCopyRoot,
} from "./svnWorkingCopy.js";

// Bootstrap exports
export { initializeCRHome } from "./bootstrap.js";

// Specs exports
export { setupSpecs, type SpecTarget } from "./specs.js";

// Workflow runtime exports
export {
  loadWorkflowRuntime,
  createRuntimeLlmClient,
  createRuntimeGitLabClient,
  createRuntimeSvnClient,
  type WorkflowRuntime,
} from "./workflowRuntime.js";
