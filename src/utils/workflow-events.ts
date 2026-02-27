import type { WorkflowEventReporter, WorkflowName, WorkflowPhaseMap } from "../types/workflows.js";

type WorkflowPhaseReporter<K extends WorkflowName> = {
  started: (phase: WorkflowPhaseMap[K], message: string) => void;
  completed: (phase: WorkflowPhaseMap[K], message: string) => void;
};

export function createWorkflowPhaseReporter<K extends WorkflowName>(
  workflow: K,
  events?: WorkflowEventReporter
): WorkflowPhaseReporter<K> {
  return {
    started: (phase, message) => {
      events?.emit({
        workflow,
        type: "phase_started",
        phase,
        message,
      });
    },
    completed: (phase, message) => {
      events?.emit({
        workflow,
        type: "phase_completed",
        phase,
        message,
      });
    },
  };
}
