# LangGraph Replacement Options

## Current Problem
- **@langchain/langgraph**: ~50-60 MB
- **@langchain/core**: ~20-30 MB  
- **Total**: ~70-90 MB of dependencies

For simple state machine workflows!

---

## Option 1: Custom Implementation (RECOMMENDED) ✅

**Size**: 0 bytes (no dependencies)  
**File**: `src/utils/workflow.ts` (already created)  
**Code**: ~50 lines

### Why This Works:

Your current LangGraph usage:
```typescript
const graph = new StateGraph(Annotation.Root({ ... }))
  .addNode("step1", fn1)
  .addNode("step2", fn2)
  .addEdge("step1", "step2")
  .addConditionalEdges("step2", condition, routes)
  .compile();

return graph.invoke(initialState);
```

Equivalent lightweight version:
```typescript
return runWorkflow({
  initialState,
  steps: {
    step1: fn1,
    step2: fn2,
  },
  routes: {
    step1: "step2",
    step2: condition, // Function returning next node
  },
  start: "step1",
  end: "end",
});
```

**Savings**: ~70-90 MB  
**Effort**: 1-2 hours to migrate 4 workflow files  
**Risk**: Low (logic stays the same, just different orchestration)

---

## Option 2: XState (~100 KB)

**Package**: `xstate`  
**Size**: ~100 KB  
**Docs**: https://xstate.js.org/

### Pros:
- Industry-standard state machine library
- Excellent TypeScript support
- Visual tools for debugging
- Well-maintained

### Cons:
- Overkill for simple sequential workflows
- Still adds 100 KB (vs 0 for custom)
- Learning curve

### Example:
```typescript
import { createMachine, interpret } from "xstate";

const workflow = createMachine({
  id: "review",
  initial: "loadRuntime",
  context: initialState,
  states: {
    loadRuntime: {
      invoke: {
        src: loadRuntimeNode,
        onDone: { target: "initLlm", actions: "updateState" },
      },
    },
    initLlm: {
      invoke: {
        src: initLlmNode,
        onDone: { target: "review", actions: "updateState" },
      },
    },
    // ...
  },
});
```

---

## Option 3: Robot3 (~3 KB)

**Package**: `robot3`  
**Size**: ~3 KB  
**Docs**: https://thisrobot.life/

### Pros:
- Tiny footprint
- Simple API
- Good for simple state machines

### Cons:
- Less features than XState
- Smaller community
- Still adds dependency

### Example:
```typescript
import { createMachine, state, transition } from "robot3";

const workflow = createMachine({
  loadRuntime: state(transition("next", "initLlm")),
  initLlm: state(transition("next", "review")),
  review: state(transition("next", "done")),
  done: state(),
});
```

---

## Option 4: Just Use Async/Await 🔥

For your sequential workflows, you might not even need the workflow runner:

```typescript
async function runReviewWorkflow(input: ReviewWorkflowInput): Promise<ReviewWorkflowResult> {
  // Initialize
  const runtime = await loadWorkflowRuntime();
  const llm = createLlmClient(runtime);
  const gitlab = input.local ? null : createGitLabClient(runtime);
  
  // Get context
  const context = input.local 
    ? await getLocalContext(input)
    : await getRemoteContext(gitlab!, input);
  
  // Review loop with feedback
  let result = await performReview(llm, context);
  while (true) {
    const feedback = await promptForFeedback();
    if (!feedback) break;
    result = await performReview(llm, context, feedback);
  }
  
  // Post results
  if (!input.local) {
    await submitToGitLab(gitlab!, result);
  }
  
  return result;
}
```

**Size**: 0 bytes  
**Complexity**: Lower than any state machine  
**Readability**: Higher  

---

## Comparison Table

| Option | Size | Complexity | Flexibility | Learning Curve |
|--------|------|------------|-------------|----------------|
| **Custom workflow.ts** | 0 KB | Low | Medium | 5 min |
| **Async/await** | 0 KB | Lowest | Low | 0 min |
| **Robot3** | 3 KB | Medium | Medium | 15 min |
| **XState** | 100 KB | High | High | 1-2 hrs |
| **LangGraph** | 70 MB | High | Overkill | 2-4 hrs |

---

## Recommendation

### For Your Use Case:

**Best Option**: Custom `workflow.ts` runner (already created)

**Why:**
1. **0 dependencies** - No added size
2. **Perfect fit** - Handles your exact pattern (sequential + conditional + loops)
3. **Simple** - ~50 lines you own and understand
4. **Type-safe** - Full TypeScript support
5. **Easy migration** - 1:1 mapping from LangGraph

### When to Use Alternatives:

- **Async/await only**: If workflows are truly sequential with minimal branching
- **Robot3**: If you want a library but keep it tiny
- **XState**: If you need complex parallel states, history, or visual debugging
- **LangGraph**: Never for this use case 😄

---

## Migration Effort

Using custom `workflow.ts`:

### Current Review Workflow (with LangGraph):
```typescript
// 520 lines in review.ts using StateGraph
```

### After Migration (with custom runner):
```typescript
// ~500 lines, but cleaner structure
return runWorkflow({
  initialState: { ... },
  steps: {
    loadRuntime: initializeRuntimeNode,
    validateLlm: validateLlmConfigNode,
    initLlm: initializeLlmClientNode,
    // ... etc
  },
  routes: {
    loadRuntime: "validateLlm",
    validateLlm: "initLlm",
    initLlm: (state) => state.input.local ? "review" : "initGitlab",
    // ... etc
  },
  start: "loadRuntime",
  end: "end",
});
```

**Estimated time**: 30 min per workflow × 4 workflows = **2 hours**  
**Result**: **70-90 MB smaller binary!**

---

## Next Steps

1. ✅ Custom workflow runner already created in `src/utils/workflow.ts`
2. Migrate one workflow as proof of concept (e.g., `review-summarize.ts`)
3. Test thoroughly
4. Migrate remaining 3 workflows
5. Remove LangGraph: `bun remove @langchain/langgraph @langchain/core`
6. Rebuild and enjoy **50% smaller binary**!

---

## TL;DR

**Use the custom `workflow.ts` I just created.**  
It's 0 bytes, handles all your patterns, and saves 70-90 MB.

Don't overthink it - your workflows are simple state machines that don't need a heavyweight library. 🚀
