import type { loadWorkflowRuntime } from "@cr/core";
import type { WorkQueue } from "./workQueue.js";

export type WebhookProvider = "gitlab" | "github" | "reviewboard";

export type ServerContext = {
  enableWeb: boolean;
  enableWebhook: boolean;
  protocol: "http" | "https";
  repoPath: string;
  runtime: Awaited<ReturnType<typeof loadWorkflowRuntime>>;
  workQueue: WorkQueue;
};
