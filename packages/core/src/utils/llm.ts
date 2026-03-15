import OpenAI from "openai";
import type { LlmConfig } from "../types/llm.js";
import { logger } from "./logger.js";
import { parseCRSseStream } from "./streamParser.js";

async function generateTextWithOpenAiLike(config: LlmConfig, prompt: string): Promise<string> {
  logger.debug("llm", `generate (openai-like), model=${config.model}, prompt_len=${prompt.length}`);
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.apiUrl,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  const result = response.choices[0]?.message?.content?.trim() ?? "";
  logger.debug("llm", `response received, len=${result.length}`);
  return result;
}

async function generateTextWithCustomStreaming(config: LlmConfig, prompt: string): Promise<string> {
  logger.debug(
    "llm",
    `generate (custom-streaming), model=${config.model}, prompt_len=${prompt.length}`
  );
  const response = await fetch(`${config.apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error("llm", `custom-streaming request failed`, { status: response.status, body });
    throw new Error(`API call failed: ${response.status} - ${body}`);
  }

  const streamText = await response.text();
  const result = parseCRSseStream(streamText).trim();
  logger.debug("llm", `custom-streaming response parsed, len=${result.length}`);
  return result;
}

export async function generateTextWithLlm(config: LlmConfig, prompt: string): Promise<string> {
  try {
    const output = config.useCustomStreaming
      ? await generateTextWithCustomStreaming(config, prompt)
      : await generateTextWithOpenAiLike(config, prompt);

    if (!output) {
      throw new Error("LLM returned empty response.");
    }
    return output;
  } catch (err) {
    logger.error("llm", "generation failed", err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}
