/**
 * Server-Sent Events (SSE) stream parsing utilities.
 */

/**
 * Parses a CR-compatible SSE stream response and extracts content.
 * Handles lines with "data: " prefix and ignores "[DONE]" markers.
 */
export function parseCRSseStream(text: string): string {
  const lines = text.trim().split(/\r?\n/);
  const contentParts: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("data: ") || line.endsWith("[DONE]")) {
      continue;
    }

    const dataStr = line.slice(6);
    try {
      const data = JSON.parse(dataStr) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.delta?.content;
      if (content) {
        contentParts.push(content);
      }
    } catch {
      continue;
    }
  }

  return contentParts.join("");
}
