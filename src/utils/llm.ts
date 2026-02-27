import OpenAI from "openai";
import type { LlmConfig } from "../types/llm.js";
import { parseCRSseStream } from "./stream-parser.js";

async function generateTextWithOpenAiLike(config: LlmConfig, prompt: string): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.apiUrl,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

async function generateTextWithCustomStreaming(config: LlmConfig, prompt: string): Promise<string> {
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
    throw new Error(`API call failed: ${response.status} - ${body}`);
  }

  const streamText = await response.text();
  return parseCRSseStream(streamText).trim();
}

export async function generateTextWithLlm(config: LlmConfig, prompt: string): Promise<string> {
  const output = config.useCustomStreaming
    ? await generateTextWithCustomStreaming(config, prompt)
    : await generateTextWithOpenAiLike(config, prompt);

  if (!output) {
    throw new Error("LLM returned empty response.");
  }
  return output;
}
