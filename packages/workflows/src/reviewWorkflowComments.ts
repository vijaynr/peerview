import type { ReviewWorkflowResult } from "@cr/core";
import { createGitLabClient, runWorkflow, type WorkflowMode } from "@cr/core";

export type PostReviewCommentResult = {
  summaryNoteId?: string;
  inlineNoteIds: string[];
};

type PostReviewGraphState = {
  result: ReviewWorkflowResult;
  mode: WorkflowMode;
  enabled: boolean;
  gitlabKey: string;
  shouldPost: boolean;
  posted: PostReviewCommentResult | null;
};

export async function maybePostReviewComment(
  result: ReviewWorkflowResult,
  mode: WorkflowMode,
  enabled: boolean,
  gitlabKey: string
): Promise<PostReviewCommentResult | null> {
  const finalState = await runWorkflow<PostReviewGraphState>({
    initialState: {
      result,
      mode,
      enabled,
      gitlabKey,
      shouldPost: false,
      posted: null,
    },
    steps: {
      decidePostReview: async (state) => {
        if (
          !state.enabled ||
          !state.result.gitlabUrl ||
          !state.result.projectPath ||
          !state.result.mrIid
        ) {
          return { shouldPost: false, posted: null };
        }
        return { shouldPost: state.enabled };
      },
      submitReviewToGitlab: async (state) => {
        if (
          !state.shouldPost ||
          !state.result.gitlabUrl ||
          !state.result.projectPath ||
          !state.result.mrIid
        ) {
          return { posted: null };
        }

        const gitlab = createGitLabClient(state.result.gitlabUrl, state.gitlabKey);
        const inlineNoteIds: string[] = [];

        if (state.result.inlineComments.length > 0) {
          for (const inline of state.result.inlineComments) {
            const noteId = await gitlab.addInlineMergeRequestComment(
              state.result.projectPath,
              state.result.mrIid,
              inline.comment,
              inline.filePath,
              inline.line,
              inline.positionType
            );
            inlineNoteIds.push(noteId);
          }
        }

        const summaryBody =
          state.result.inlineComments.length > 0
            ? [
                "## Overall Review Summary",
                "",
                state.result.overallSummary?.trim() || state.result.output,
                "",
                "> **AI-Assisted Review:** Treat this as a first-pass analysis and confirm all findings manually.",
              ].join("\n")
            : state.result.output;

        const summaryNoteId = await gitlab.addMergeRequestComment(
          state.result.projectPath,
          state.result.mrIid,
          summaryBody
        );

        return { posted: { summaryNoteId, inlineNoteIds } };
      },
    },
    routes: {
      decidePostReview: (state) => (state.shouldPost ? "submitReviewToGitlab" : "end"),
      submitReviewToGitlab: "end",
    },
    start: "decidePostReview",
    end: "end",
  });

  return finalState.posted;
}
