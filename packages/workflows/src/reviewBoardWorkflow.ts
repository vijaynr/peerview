import {
  createReviewBoardClient,
  createRuntimeLlmClient,
  createRuntimeReviewBoardClient,
  createRuntimeSvnClient,
  DEFAULT_REVIEW_AGENT_NAME,
  type LlmClient,
  loadPrompt,
  loadReviewAgentPrompt,
  loadSvnRepositoryGuidelines,
  loadWorkflowRuntime,
  normalizeReviewAgentNames,
  type ReviewBoardClient,
  type ReviewWorkflowEffect,
  type ReviewWorkflowInput,
  type ReviewWorkflowResponse,
  type ReviewWorkflowResult,
  runWorkflow,
  type WorkflowRuntime,
} from "@pv/core";
import { injectMergeRequestContextIntoTemplate } from "./reviewWorkflowHelper.js";
import { createWorkflowPhaseReporter } from "./workflowEvents.js";

const WORKFLOW_NAME = "review";

type AgentExecutionResult = NonNullable<ReviewWorkflowResult["agentResults"]>[number];

type ReviewBoardContext = {
  requestId: number;
  request: Awaited<ReturnType<ReviewBoardClient["getReviewRequest"]>>;
  diffSet: { id: number; revision: number };
  files: Array<{ id: number; source_file: string; dest_file: string }>;
  rawDiff: string;
  guidelines?: string;
};

type ReviewWorkflowResponseInput = ReviewWorkflowResponse | undefined;

type ReviewBoardGraphState = {
  input: ReviewWorkflowInput;
  runtime: WorkflowRuntime | null;
  llm: LlmClient | null;
  rb: ReviewBoardClient | null;
  context: ReviewBoardContext | null;
  result: ReviewWorkflowResult | null;
  pendingFeedback: string;
  feedbackUsed: boolean;
};

function reportFeedbackRegeneration(input: Pick<ReviewWorkflowInput, "status">): void {
  input.status?.info("Regenerating review with your feedback...");
}

function reportInlineCommentLimitation(
  input: Pick<ReviewWorkflowInput, "inlineComments" | "status">
): void {
  if (input.inlineComments) {
    input.status?.warning(
      "Review Board inline diff comments are not supported yet. This review will post a summary comment only."
    );
  }
}

function assertResponseType(response: ReviewWorkflowResponseInput): ReviewWorkflowResponse {
  if (!response || response.type !== "review_feedback") {
    const actual = response?.type ?? "none";
    throw new Error(`Expected review workflow response "review_feedback", received "${actual}".`);
  }
  return response;
}

function shouldUseAgentProfiles(selectedAgents: string[]): boolean {
  return !(selectedAgents.length === 1 && selectedAgents[0] === DEFAULT_REVIEW_AGENT_NAME);
}

function buildReviewResult(args: {
  output: string;
  contextLabel: string;
  selectedAgents: string[];
  aggregated: boolean;
  agentResults?: ReviewWorkflowResult["agentResults"];
  rbUrl?: string;
  mrIid?: number;
  guidelines?: string;
}): ReviewWorkflowResult {
  return {
    output: args.output,
    contextLabel: args.contextLabel,
    selectedAgents: args.selectedAgents,
    aggregated: args.aggregated,
    inlineComments: [],
    agentResults: args.agentResults,
    rbUrl: args.rbUrl,
    mrIid: args.mrIid,
    guidelines: args.guidelines,
  };
}

function buildPromptContext(context: ReviewBoardContext) {
  return {
    mrContent: `${context.request.summary}\n\n${context.request.description}`,
    mrChanges: context.rawDiff || context.files.map((f) => f.dest_file).join("\n"),
    mrCommits: "N/A",
    guidelines: context.guidelines,
    contextLabel: `Review Request #${context.requestId}`,
  };
}

function prependFeedback(prompt: string, feedback?: string): string {
  return feedback?.trim()
    ? `Human feedback for this re-run:\n${feedback.trim()}\n\n${prompt}`
    : prompt;
}

async function runReviewAgent(args: {
  agentName: string;
  promptContext: ReturnType<typeof buildPromptContext>;
  repoRoot: string;
  llm: LlmClient;
  userFeedback?: string;
}): Promise<AgentExecutionResult> {
  const template = await loadReviewAgentPrompt(args.agentName, args.repoRoot);
  const prompt = prependFeedback(
    injectMergeRequestContextIntoTemplate(template, {
      mrContent: args.promptContext.mrContent,
      mrChanges: args.promptContext.mrChanges,
      mrCommits: args.promptContext.mrCommits,
      guidelines: args.promptContext.guidelines,
    }),
    args.userFeedback
  );

  return {
    name: args.agentName,
    output: (await args.llm.generate(prompt)).trim(),
  };
}

function fillAggregateTemplate(
  template: string,
  args: {
    contextLabel: string;
    successfulAgentOutputs: string;
    failedAgents: string;
  }
): string {
  return template
    .replaceAll("{context_label}", args.contextLabel)
    .replaceAll("{agent_outputs}", args.successfulAgentOutputs)
    .replaceAll("{failed_agents}", args.failedAgents);
}

async function aggregateAgentOutputs(args: {
  llm: LlmClient;
  repoRoot: string;
  promptContext: ReturnType<typeof buildPromptContext>;
  successfulAgents: AgentExecutionResult[];
  failedAgents: AgentExecutionResult[];
}): Promise<string> {
  const template = await loadPrompt("review-aggregate.txt", args.repoRoot);
  const prompt = fillAggregateTemplate(template, {
    contextLabel: args.promptContext.contextLabel,
    successfulAgentOutputs: args.successfulAgents
      .map((result) => `## ${result.name}\n${result.output}`)
      .join("\n\n"),
    failedAgents:
      args.failedAgents.length > 0
        ? args.failedAgents
            .map((result) => `- ${result.name}: ${result.error ?? "Unknown error"}`)
            .join("\n")
        : "- None",
  });

  return (await args.llm.generate(prompt)).trim();
}

async function runParallelAgentReviews(args: {
  selectedAgents: string[];
  promptContext: ReturnType<typeof buildPromptContext>;
  repoRoot: string;
  llm: LlmClient;
  userFeedback?: string;
}): Promise<{ output: string; aggregated: boolean; agentResults: AgentExecutionResult[] }> {
  const settled = await Promise.allSettled(
    args.selectedAgents.map((agentName) =>
      runReviewAgent({
        agentName,
        promptContext: args.promptContext,
        repoRoot: args.repoRoot,
        llm: args.llm,
        userFeedback: args.userFeedback,
      })
    )
  );

  const agentResults: AgentExecutionResult[] = settled.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : {
          name: args.selectedAgents[index],
          output: "",
          failed: true,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        }
  );

  const successfulAgents = agentResults.filter((result) => !result.failed);
  const failedAgents = agentResults.filter((result) => result.failed);

  if (successfulAgents.length === 0) {
    throw new Error("All review agents failed. No aggregated review could be generated.");
  }

  if (successfulAgents.length === 1 && args.selectedAgents.length === 1) {
    return {
      output: successfulAgents[0].output,
      aggregated: false,
      agentResults,
    };
  }

  return {
    output: await aggregateAgentOutputs({
      llm: args.llm,
      repoRoot: args.repoRoot,
      promptContext: args.promptContext,
      successfulAgents,
      failedAgents,
    }),
    aggregated: true,
    agentResults,
  };
}

export async function runReviewBoardWorkflow(
  input: ReviewWorkflowInput & { userFeedback?: string }
): Promise<ReviewWorkflowResult> {
  reportInlineCommentLimitation(input);

  const initialState: ReviewBoardGraphState = {
    input,
    runtime: null,
    llm: null,
    rb: null,
    context: null,
    result: null,
    pendingFeedback: input.userFeedback ?? "",
    feedbackUsed: false,
  };

  const finalState = await runWorkflow<ReviewBoardGraphState>({
    initialState,
    steps: {
      init: async () => {
        const runtime = await loadWorkflowRuntime();
        const llm = createRuntimeLlmClient(runtime);
        const rb = createRuntimeReviewBoardClient(runtime);
        return { runtime, llm, rb };
      },
      loadContext: async (state) => {
        const rb = state.rb!;
        const requestId = state.input.mrIid!;
        const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, state.input.events);
        phaseReporter.started("load_mr_context", "Loading Review Board context...");

        const request = await rb.getReviewRequest(requestId);
        const diffSet = await rb.getLatestDiffSet(requestId);
        if (!diffSet) {
          throw new Error(`No diffs found for review request #${requestId}`);
        }
        const files = await rb.getFileDiffs(requestId, diffSet.id);
        const rawDiff = await rb.getRawDiff(requestId, diffSet.revision);
        let guidelines: string | undefined;
        try {
          guidelines = await loadSvnRepositoryGuidelines(createRuntimeSvnClient(state.runtime!));
        } catch {
          // Ignore errors fetching guidelines
        }

        phaseReporter.completed("load_mr_context", "Loaded Review Board context.");
        return { context: { requestId, request, diffSet, files, rawDiff, guidelines } };
      },
      generateReview: async (state) => {
        const llm = state.llm!;
        const context = state.context!;
        const phaseReporter = createWorkflowPhaseReporter(WORKFLOW_NAME, state.input.events);
        const selectedAgents = normalizeReviewAgentNames(state.input.agentNames);
        const promptContext = buildPromptContext(context);
        phaseReporter.started(
          "generate_review",
          shouldUseAgentProfiles(selectedAgents) && selectedAgents.length > 1
            ? `Analyzing Review Board changes with ${selectedAgents.length} agents...`
            : "Analyzing Review Board changes..."
        );

        if (shouldUseAgentProfiles(selectedAgents)) {
          const parallelReview = await runParallelAgentReviews({
            selectedAgents,
            promptContext,
            repoRoot: state.input.repoRoot,
            llm,
            userFeedback: state.pendingFeedback,
          });

          phaseReporter.completed("generate_review", "Generated review analysis.");
          return {
            result: buildReviewResult({
              output: parallelReview.output,
              contextLabel: promptContext.contextLabel,
              selectedAgents,
              aggregated: parallelReview.aggregated,
              agentResults: parallelReview.agentResults,
              rbUrl: state.runtime?.rbUrl,
              mrIid: context.requestId,
              guidelines: context.guidelines,
            }),
          };
        }

        const template = await loadPrompt("review.txt", state.input.repoRoot);
        const prompt = prependFeedback(
          injectMergeRequestContextIntoTemplate(template, {
            mrContent: promptContext.mrContent,
            mrChanges: promptContext.mrChanges,
            mrCommits: promptContext.mrCommits,
            guidelines: promptContext.guidelines,
          }),
          state.pendingFeedback
        );

        const reviewOutput = await llm.generate(prompt);

        phaseReporter.completed("generate_review", "Generated review analysis.");

        return {
          result: buildReviewResult({
            output: reviewOutput,
            contextLabel: promptContext.contextLabel,
            selectedAgents,
            aggregated: false,
            rbUrl: state.runtime?.rbUrl,
            mrIid: context.requestId,
            guidelines: context.guidelines,
          }),
        };
      },
    },
    routes: {
      init: "loadContext",
      loadContext: "generateReview",
      generateReview: "end",
    },
    start: "init",
    end: "end",
  });

  return finalState.result!;
}

export async function* runInteractiveReviewBoardWorkflow(
  input: ReviewWorkflowInput & { userFeedback?: string }
): AsyncGenerator<ReviewWorkflowEffect, ReviewWorkflowResult, ReviewWorkflowResponseInput> {
  let feedback = input.userFeedback?.trim() ?? "";

  for (;;) {
    const result = await runReviewBoardWorkflow({
      ...input,
      userFeedback: feedback,
    });

    yield {
      type: "review_ready",
      result,
    };

    if (input.mode !== "interactive") {
      return result;
    }

    const response = assertResponseType(
      yield {
        type: "request_review_feedback",
        result,
      }
    );
    const nextFeedback = response.feedback?.trim() ?? "";
    if (!nextFeedback) {
      return result;
    }

    reportFeedbackRegeneration(input);
    feedback = nextFeedback;
  }
}

export async function maybePostReviewBoardComment(
  result: ReviewWorkflowResult,
  _mode: string,
  enabled: boolean,
  rbToken: string
): Promise<{ summaryNoteId?: string; inlineNoteIds: string[] } | null> {
  if (!enabled || !result.rbUrl || !result.mrIid) return null;

  const rb = createReviewBoardClient(result.rbUrl, rbToken);
  const requestId = result.mrIid;
  const summaryBody = result.overallSummary || result.output;
  const review = await rb.createReview(requestId, summaryBody);
  await rb.publishReview(requestId, review.id);

  return { summaryNoteId: String(review.id), inlineNoteIds: [] };
}
