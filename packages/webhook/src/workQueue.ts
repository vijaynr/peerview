import { logger, repoRootFromModule, type WorkflowRuntime } from "@cr/core";
import {
  maybePostReviewBoardComment,
  maybePostReviewComment,
  runReviewBoardWorkflow,
  runReviewWorkflow,
} from "@cr/workflows";
import type { ReviewJob } from "./index.js";

export class WorkQueue {
  private queue: ReviewJob[] = [];
  private processing = new Map<string, ReviewJob>();
  private completed = new Map<string, ReviewJob>();
  private activeWorkers = 0;

  constructor(private runtime: WorkflowRuntime) {}

  public enqueue(
    provider: "gitlab" | "reviewboard",
    projectId: number | string,
    mrIid: number
  ): string | null {
    if (this.queue.length >= this.runtime.webhookQueueLimit) {
      logger.error("webhook", "Queue at capacity, rejecting job", {
        queueSize: this.queue.length,
        maxSize: this.runtime.webhookQueueLimit,
        provider,
        projectId,
        mrIid,
      });
      return null;
    }

    const jobId = `${provider}-${projectId}-${mrIid}-${Date.now()}`;
    const job: ReviewJob = {
      id: jobId,
      provider,
      projectId,
      mrIid,
      status: "queued",
      queuedAt: new Date(),
    };

    this.queue.push(job);
    console.log(`[QUEUE] Job ${jobId} queued (Position: ${this.queue.length})`);

    // Start processing if workers available
    this.processNext();

    return jobId;
  }

  private async processNext() {
    if (this.activeWorkers >= this.runtime.webhookConcurrency) {
      return;
    }

    const job = this.queue.shift();
    if (!job) {
      return;
    }

    this.activeWorkers++;
    this.processing.set(job.id, job);
    job.status = "processing";
    job.startedAt = new Date();

    console.log(
      `[WORKER] Starting job ${job.id} (Active: ${this.activeWorkers}/${this.runtime.webhookConcurrency}, Provider: ${job.provider})`
    );

    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Job timed out after ${this.runtime.webhookJobTimeoutMs}ms`));
        }, this.runtime.webhookJobTimeoutMs);
      });

      // Run the actual review
      const reviewPromise = (async () => {
        const repoRoot = repoRootFromModule(import.meta.url);
        const agentNames = this.runtime.defaultReviewAgents;
        const agentMode = agentNames.length > 1 ? "multi" : "single";

        if (job.provider === "reviewboard") {
          const result = await runReviewBoardWorkflow({
            repoPath: process.cwd(),
            repoRoot,
            mode: "ci",
            workflow: "review",
            local: false,
            mrIid: Number(job.mrIid),
            state: "opened",
            inlineComments: false,
            provider: "reviewboard",
            agentNames,
            agentMode,
          });
          await maybePostReviewBoardComment(result, "ci", true, this.runtime.rbToken);
          return result;
        } else {
          const projectPath = String(job.projectId);
          const gitlabUrl = this.runtime.gitlabUrl;
          const result = await runReviewWorkflow({
            repoPath: process.cwd(),
            repoRoot,
            mode: "ci",
            workflow: "review",
            local: false,
            mrIid: Number(job.mrIid),
            url: `${gitlabUrl}/${projectPath}/-/merge_requests/${job.mrIid}`,
            state: "opened",
            inlineComments: false,
            agentNames,
            agentMode,
          });

          await maybePostReviewComment(result, "ci", true, this.runtime.gitlabKey);
          return result;
        }
      })();

      // Wait for either completion or timeout
      await Promise.race([reviewPromise, timeoutPromise]);

      job.status = "completed";
      console.log(`[WORKER] Job ${job.id} completed successfully.`);
      logger.success("webhook", `Job ${job.id} completed`);
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      console.error(`[WORKER] Job ${job.id} failed:`, job.error);
      logger.error("webhook", `Job ${job.id} failed`, err);
    } finally {
      job.completedAt = new Date();
      this.processing.delete(job.id);
      this.completed.set(job.id, job);
      this.activeWorkers--;

      // Cleanup old completed jobs (keep last 100)
      if (this.completed.size > 100) {
        const oldestId = this.completed.keys().next().value;
        if (oldestId) this.completed.delete(oldestId);
      }

      // Check for next job
      this.processNext();
    }
  }

  public getStatus() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      activeWorkers: this.activeWorkers,
    };
  }
}
