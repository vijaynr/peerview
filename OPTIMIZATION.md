# Binary Size Optimization Guide

Current binary size: **112.87 MB**

## Major Size Culprits

### 1. @langchain/langgraph (~40-60 MB)
**Used for:** Simple state machine workflow management
**Problem:** Massive library with LangChain ecosystem dependencies
**Solution:** Replace with lightweight custom state machine

### 2. @langchain/core (~20-30 MB)
**Used for:** Required by langgraph
**Solution:** Remove along with langgraph

### 3. @gitbeaker/rest (Not used)
**Problem:** Not imported anywhere in the code
**Solution:** Remove from dependencies

### 4. chalk (Not used)
**Problem:** Not imported (using ANSI codes directly)
**Solution:** Remove from dependencies

### 5. dotenv (Likely not needed)
**Problem:** Bun natively reads .env files
**Solution:** Remove if not explicitly used

## Optimization Steps

### Step 1: Remove Unused Dependencies (Easy - 5 min)

```bash
# Remove unused packages
bun remove chalk @gitbeaker/rest dotenv

# This should save ~10-15 MB
```

### Step 2: Replace LangGraph (Medium - 30 min)

LangGraph is being used as a simple state machine. The actual usage:

```typescript
const graph = new StateGraph(
  Annotation.Root({
    input: Annotation<ReviewWorkflowInput>(),
    runtime: Annotation<WorkflowRuntime | null>(),
    // ... etc
  })
);

graph.addNode("init", initNode);
graph.addNode("review", reviewNode);
graph.addEdge(START, "init");
graph.addEdge("init", "review");
graph.addEdge("review", END);

const compiled = graph.compile();
return compiled.invoke({ input });
```

**This can be replaced with:**

```typescript
// Simple sequential workflow runner
type WorkflowStep<S> = (state: S) => Promise<Partial<S>>;

async function runWorkflow<S>(
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

// Usage:
return runWorkflow(initialState, [
  initNode,
  reviewNode,
  generateNode
]);
```

**Savings:** ~50-60 MB

### Step 3: Use Bun's Built-in Minification

Add to build command:

```json
"build:bin": "bun build --compile --minify --sourcemap=external src/cli.ts --outfile dist/cr"
```

**Savings:** ~5-10 MB

### Step 4: Exclude Dev Dependencies from Bundle

Ensure these are in `devDependencies` (already done):
- TypeScript
- ESLint
- Prettier
- @types/*

### Step 5: Consider External Dependencies

Some dependencies could be made external (not bundled):
- `openai` - Could use native fetch instead (~2 MB)
- `marked` + `marked-terminal` - Could simplify markdown rendering (~1-2 MB)

## Expected Results

| Optimization | Size Reduction | Effort |
|-------------|----------------|--------|
| Remove unused deps | 10-15 MB | 2 min |
| Remove LangGraph | 50-60 MB | 30 min |
| Enable minification | 5-10 MB | 1 min |
| Replace OpenAI SDK | 2-3 MB | 15 min |
| Simplify markdown | 1-2 MB | 10 min |
| **Total** | **68-90 MB** | **~1 hour** |

**Target size:** 20-45 MB (from 113 MB)

## Implementation Priority

1. **High Priority** (Quick wins):
   - Remove unused deps: `bun remove chalk @gitbeaker/rest dotenv`
   - Enable minification in build command

2. **Medium Priority** (Best ROI):
   - Replace LangGraph with simple workflow runner

3. **Low Priority** (Diminishing returns):
   - Replace OpenAI SDK with fetch
   - Simplify markdown rendering

## Quick Start

For immediate 20% reduction with minimal effort:

```bash
# 1. Remove unused deps
bun remove chalk @gitbeaker/rest dotenv

# 2. Enable minification
# Update package.json:
# "build:bin": "bun build --compile --minify src/cli.ts --outfile dist/cr"

# 3. Rebuild
bun run build
```

This will reduce the binary from **113 MB → ~90 MB** in under 5 minutes.

## Notes

- Bun bundles the entire runtime (~80MB) which can't be reduced
- The remaining size comes from dependencies
- Most optimizations involve removing or replacing heavy libraries
- LangGraph replacement gives the biggest win for the effort
