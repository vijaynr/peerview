/**
 * Test preload — runs BEFORE any test-file imports are resolved.
 *
 * Bun 1.3.x caches module evaluations within a test worker.  When a test file
 * mocks `@pv/core` or `@pv/workflows`, the mock only takes effect for modules
 * that have not yet been loaded.  Because ESM `import` declarations are hoisted
 * above user code (`mock.module()` calls), the *real* modules are often already
 * cached before the mock is registered.
 *
 * By registering stub mocks here (in a preload script), we ensure the mock
 * registry intercepts `@pv/core` and `@pv/workflows` from the very first
 * import.  Individual test files then call `mock.module()` again with their own
 * factories — Bun replaces the factory and re-evaluates the module for new
 * callers while keeping ESM live-bindings up-to-date.
 */

import { mock } from "bun:test";
import { makeCoreMock, makeUiMock, makeWorkflowsMock } from "./mocks.ts";

mock.module("@pv/tui", () => makeUiMock());
mock.module("@pv/core", () => makeCoreMock());
mock.module("@pv/workflows", () => makeWorkflowsMock());

// Pre-register node:child_process with all real exports so that test files
// that mock only `spawnSync` don't destroy the rest of the module for later tests.
import * as realChildProcess from "node:child_process";
mock.module("node:child_process", () => ({ ...realChildProcess }));
