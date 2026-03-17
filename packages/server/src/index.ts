export { startServer, startServer as startWebhookServer } from "./server.js";

export type ReviewJobStatus = "queued" | "processing" | "completed" | "failed";

export type ReviewJob = {
  id: string;
  provider: "gitlab" | "reviewboard";
  projectId: number | string;
  mrIid: number;
  status: ReviewJobStatus;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
};
