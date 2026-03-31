import type { loadWorkflowRuntime } from "@pv/core";
import type { WorkQueue } from "./workQueue.js";

export type WebhookProvider = "gitlab" | "github" | "reviewboard";

export type ServerContext = {
  enableWeb: boolean;
  enableWebhook: boolean;
  desktop: boolean;
  protocol: "http" | "https";
  repoPath: string;
  runtime: Awaited<ReturnType<typeof loadWorkflowRuntime>>;
  workQueue: WorkQueue;
};
