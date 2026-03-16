/**
 * Shared mock factories for @cr/tui and @cr/core.
 *
 * Bun 1.3.x shares the module-mock registry within a test worker — when one
 * test file sets a partial mock for a package, subsequent test files cannot
 * add export names that were absent from the previous mock (Bun validates new
 * mocks against the currently-registered export list and throws a SyntaxError).
 *
 * Solution: every test that calls mock.module() for @cr/tui or @cr/core must
 * provide the FULL union of exports that any test may ever need. These factory
 * functions return that comprehensive base object, with the caller's overrides
 * applied on top so individual tests can still inject their own spy functions.
 */

import { mock } from "bun:test";

// ---------------------------------------------------------------------------
// @cr/tui
// ---------------------------------------------------------------------------

export function makeUiMock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    // constants
    COLORS: {
      cyan: "",
      green: "",
      yellow: "",
      red: "",
      reset: "",
      bold: "",
      dim: "",
      white: "",
      blue: "",
      magenta: "",
    },
    BANNER_COLOR: "",
    DOT: ".",
    BORDERS: { top: "", bottom: "", left: "", right: "" },
    // console helpers
    printWorkflowOutput: mock(() => {}),
    printRawOutput: mock(() => {}),
    printHorizontalLine: mock(() => {}),
    printDivider: mock(() => {}),
    printHeaderBox: mock(() => {}),
    printSuccess: mock(() => {}),
    printInfo: mock(() => {}),
    printWarning: mock(() => {}),
    printError: mock(() => {}),
    printEmptyLine: mock(() => {}),
    printAlert: mock(() => {}),
    printCommandHelp: mock(() => {}),
    printHelpView: mock(() => {}),
    printReviewComment: mock(() => {}),
    printReviewSummary: mock(() => {}),
    printChatAnswer: mock(() => {}),
    printBanner: mock(async () => {}),
    // prompt helpers
    promptWithFrame: mock(async () => ({})),
    askForOptionalFeedback: mock(async () => null),
    abortOnCancel: { onCancel: () => false },
    // live workflow helpers
    createWorkflowStatusController: mock(() => ({
      status: { info: () => {}, success: () => {}, warning: () => {}, error: () => {} },
      events: { emit: () => {} },
      stop: () => {},
      close: () => {},
    })),
    runLiveTask: mock(async (_title: string, run: (ui: unknown) => Promise<void>) => run({})),
    runLiveChatLoop: mock(async () => {}),
    runLiveCreateReviewTask: mock(async () => ({})),
    runLiveCreateMrTask: mock(async () => ({})),
    // spinner
    createSpinner: mock(() => ({
      start() {
        return this;
      },
      stop() {
        return this;
      },
      succeed() {
        return this;
      },
      fail() {
        return this;
      },
      stopAndPersist() {
        return this;
      },
    })),
    // banner
    BANNER_TEXT: "",
    BANNER_LOGO: "",
    // markdown
    renderMarkdownForTerminal: mock((s: string) => s),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// @cr/core
// ---------------------------------------------------------------------------

export function makeCoreMock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    // config
    loadCRConfig: mock(async () => ({})),
    saveCRConfig: mock(async () => {}),
    readCRConfigContents: mock(async () => ""),
    envOrConfig: (_key: string, value: string | undefined, fallback: string) => value ?? fallback,
    CR_CONF_PATH: "/mock/.cr.conf",
    defaultConfig: {},
    // bootstrap / setup
    initializeCRHome: mock(async () => {}),
    setupRpi: mock(async () => []),
    setupSpecs: mock(async () => {}),
    repoRootFromModule: mock(() => "/mock/root"),
    CR_ASSETS_DIR: "/mock/.cr",
    CR_DIR: "/mock/.cr",
    CR_PROMPTS_DIR: "/mock/.cr/prompts",
    CR_LOGS_DIR: "/mock/.cr/logs",
    HOME_DIR: "/mock",
    resourcesPathFromRepoRoot: mock(() => ""),
    // logging
    logger: {
      debug: mock(() => {}),
      info: mock(() => {}),
      success: mock(() => {}),
      warn: mock(() => {}),
      warning: mock(() => {}),
      error: mock(() => {}),
    },
    // git helpers
    getOriginRemoteUrl: mock(async () => ""),
    getCurrentBranch: mock(async () => "main"),
    detectGitProvider: mock(async () => "gitlab"),
    // prompts / agents
    DEFAULT_REVIEW_AGENT_NAME: "general",
    loadPrompt: mock(async () => ""),
    loadReviewAgentPrompt: mock(async () => ""),
    listBundledReviewAgentNames: mock(() => []),
    normalizeReviewAgentNames: mock((names?: string[]) => names ?? ["general"]),
    // gitlab helpers
    remoteToProjectPath: mock(() => ""),
    listBranches: mock(async () => []),
    listMergeRequests: mock(async () => []),
    findOpenMergeRequestBySourceBranch: mock(async () => null),
    getMergeRequest: mock(async () => ({})),
    getMergeRequestChanges: mock(async () => []),
    getMergeRequestCommits: mock(async () => []),
    compareBranches: mock(async () => ""),
    findExistingMergeRequest: mock(async () => null),
    createMergeRequest: mock(async () => ({})),
    updateMergeRequest: mock(async () => ({})),
    addMergeRequestComment: mock(async () => {}),
    getMergeRequestInlineComments: mock(async () => []),
    addInlineMergeRequestComment: mock(async () => {}),
    // github helpers
    remoteToGitHubRepoPath: mock(() => ""),
    isGitHubRemote: mock(() => false),
    listGitHubBranches: mock(async () => []),
    getGitHubDefaultBranch: mock(async () => "main"),
    githubBranchExists: mock(async () => false),
    listGitHubPullRequests: mock(async () => []),
    findOpenGitHubPullRequestByHead: mock(async () => null),
    getGitHubPullRequest: mock(async () => ({})),
    getGitHubPullRequestFiles: mock(async () => []),
    getGitHubPullRequestCommits: mock(async () => []),
    getGitHubFileContent: mock(async () => null),
    addGitHubPullRequestComment: mock(async () => ""),
    addGitHubInlinePullRequestComment: mock(async () => ""),
    compareGitHubBranches: mock(async () => ""),
    findExistingGitHubPullRequest: mock(async () => null),
    createGitHubPullRequest: mock(async () => ""),
    updateGitHubPullRequest: mock(async () => ""),
    // svn helpers
    isSvnWorkingCopy: mock(async () => false),
    getSvnDiff: mock(async () => ""),
    getSvnRepoRootUrl: mock(async () => ""),
    getSvnWorkingCopyUrl: mock(async () => ""),
    getSvnWorkingCopyRoot: mock(async () => ""),
    svnGetFile: mock(async () => ""),
    resolveSvnFileUrl: mock(() => ""),
    // review board helpers
    rbRequest: mock(async () => ({})),
    getCurrentUser: mock(async () => ({})),
    listRepositories: mock(async () => []),
    listReviewRequests: mock(async () => []),
    getReviewRequest: mock(async () => ({})),
    getLatestDiffSet: mock(async () => null),
    getFileDiffs: mock(async () => []),
    getFileDiffData: mock(async () => ({})),
    createReviewRequest: mock(async () => ({})),
    updateReviewRequestDraft: mock(async () => ({})),
    uploadReviewRequestDiff: mock(async () => ({})),
    publishReviewRequest: mock(async () => ({})),
    createReview: mock(async () => ({})),
    addDiffComment: mock(async () => {}),
    publishReview: mock(async () => {}),
    reviewBoardToRequestId: mock(() => 0),
    // LLM helpers
    generateTextWithLlm: mock(async () => ""),
    loadGitHubRepositoryGuidelines: mock(async () => undefined),
    loadLocalRepositoryGuidelines: mock(async () => undefined),
    loadGitLabRepositoryGuidelines: mock(async () => undefined),
    loadSvnRepositoryGuidelines: mock(async () => undefined),
    // runtime factories
    loadWorkflowRuntime: mock(async () => ({})),
    createRuntimeLlmClient: mock(() => ({ generate: mock(async () => "") })),
    createRuntimeGitLabClient: mock(() => ({})),
    createRuntimeGitHubClient: mock(() => ({})),
    createRuntimeSvnClient: mock(() => null),
    createRuntimeReviewBoardClient: mock(() => ({})),
    // client constructors / factories
    GitLabClient: mock(() => ({})),
    createGitLabClient: mock(() => ({})),
    GitHubClient: mock(() => ({})),
    createGitHubClient: mock(() => ({})),
    createSvnClient: mock(() => ({})),
    createReviewBoardClient: mock(() => ({})),
    createLlmClient: mock(() => ({})),
    assert: mock((value: unknown, message: string) => {
      if (!value) {
        throw new Error(message);
      }
      return value;
    }),
    // workflow utilities
    runWorkflow: mock(async () => ({})),
    runSequentialWorkflow: mock(async () => ({})),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// @cr/workflows
// ---------------------------------------------------------------------------

export function makeWorkflowsMock(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    runReviewWorkflow: mock(async () => ({
      output: "",
      contextLabel: "",
      inlineComments: [],
      selectedAgents: [],
      aggregated: false,
    })),
    runInteractiveReviewWorkflow: mock(async function* () {
      return {};
    }),
    runReviewBoardWorkflow: mock(async () => ({
      output: "",
      contextLabel: "",
      inlineComments: [],
      selectedAgents: [],
      aggregated: false,
      rbUrl: "",
      mrIid: 0,
    })),
    runInteractiveReviewBoardWorkflow: mock(async function* () {
      return {};
    }),
    maybePostGitHubReviewComment: mock(async () => null),
    maybePostReviewBoardComment: mock(async () => null),
    runReviewChatWorkflow: mock(async () => ({
      contextLabel: "",
      mrContent: "",
      mrChanges: "",
      mrCommits: "",
      summary: "",
    })),
    answerReviewChatQuestion: mock(async () => ({ answer: "", history: [] })),
    runReviewSummarizeWorkflow: mock(async () => ({
      output: "",
      contextLabel: "",
      inlineComments: [],
      selectedAgents: [],
      aggregated: false,
    })),
    runCreateReviewWorkflow: mock(async function* () {
      return {};
    }),
    runCreateMrWorkflow: mock(async function* () {
      return {};
    }),
    runInteractiveReviewSession: mock(async function* () {
      return {};
    }),
    maybePostReviewComment: mock(async () => null),
    createWorkflowPhaseReporter: mock(() => ({})),
    extractJsonObject: mock((text: string) => ({})),
    injectMergeRequestContextIntoTemplate: mock((template: string) => template),
    applyReviewTemplate: mock((template: string) => template),
    buildChatPrompt: mock(() => ""),
    resolveInlinePosition: mock(() => null),
    buildInlineReviewPrompt: mock(() => ""),
    parseDiffHunks: mock(() => []),
    ...overrides,
  };
}
