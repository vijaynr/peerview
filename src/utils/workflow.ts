/**
 * Lightweight workflow runner - replaces LangGraph
 * No dependencies, ~50 lines of code
 */

export type WorkflowStep<S> = (state: S) => Promise<Partial<S>>;
export type ConditionalRoute<S> = (state: S) => string;

/**
 * Simple sequential workflow runner
 */
export async function runSequentialWorkflow<S>(
  initialState: S,
  steps: WorkflowStep<S>[]
): Promise<S> {
  let state = initialState;
  for (const step of steps) {
    const updates = await step(state);
    state = { ...state, ...updates };
  }
  return state;
}

/**
 * Workflow with conditional branching and loops
 */
export async function runWorkflow<S>(config: {
  initialState: S;
  steps: Record<string, WorkflowStep<S>>;
  routes: Record<string, string | ConditionalRoute<S>>;
  start: string;
  end: string;
}): Promise<S> {
  const { initialState, steps, routes, start, end } = config;
  let state = initialState;
  let currentNode = start;

  while (currentNode !== end) {
    // Execute current step
    const step = steps[currentNode];
    if (!step) {
      throw new Error(`Workflow step "${currentNode}" not found`);
    }

    const updates = await step(state);
    state = { ...state, ...updates };

    // Determine next node
    const route = routes[currentNode];
    if (typeof route === "string") {
      // Direct route
      currentNode = route;
    } else if (typeof route === "function") {
      // Conditional route
      currentNode = route(state);
    } else {
      throw new Error(`No route defined for node "${currentNode}"`);
    }
  }

  return state;
}

/**
 * Example: Simplified review workflow
 */
/*
const result = await runWorkflow({
  initialState: {
    input,
    runtime: null,
    llm: null,
    result: null,
    pendingFeedback: "",
  },
  steps: {
    loadRuntime: async (state) => ({
      runtime: await loadWorkflowRuntime(),
    }),
    initLlm: async (state) => ({
      llm: createLlmClient(state.runtime!),
    }),
    review: async (state) => ({
      result: await performReview(state),
    }),
    promptFeedback: async (state) => ({
      pendingFeedback: await askForFeedback(),
    }),
  },
  routes: {
    loadRuntime: "initLlm",
    initLlm: "review",
    review: "promptFeedback",
    promptFeedback: (state) =>
      state.pendingFeedback ? "review" : "end",
  },
  start: "loadRuntime",
  end: "end",
});
*/
