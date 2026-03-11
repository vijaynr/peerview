import type {
  CreateMrWorkflowEffect,
  CreateMrWorkflowInput,
  CreateMrWorkflowResponse,
  CreateMrWorkflowResult,
} from "@cr/core";
import { runCreateReviewWorkflow } from "./createReviewWorkflow.js";

export async function* runCreateMrWorkflow(
  input: CreateMrWorkflowInput
): AsyncGenerator<CreateMrWorkflowEffect, CreateMrWorkflowResult, CreateMrWorkflowResponse | undefined> {
  return yield* runCreateReviewWorkflow({
    ...input,
    provider: "gitlab",
  });
}
