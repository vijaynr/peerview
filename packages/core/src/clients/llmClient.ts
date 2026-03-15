import type { LlmConfig } from "../types/llm.js";
import { generateTextWithLlm } from "../utils/llm.js";

export interface LlmClient {
  generate(prompt: string): Promise<string>;
}

export function createLlmClient(config: LlmConfig): LlmClient {
  return {
    generate: async (prompt: string) => generateTextWithLlm(config, prompt),
  };
}
