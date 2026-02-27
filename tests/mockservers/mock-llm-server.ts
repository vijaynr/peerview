type LoggedRequest = {
  method: string;
  path: string;
  body: string;
  headers: Headers;
};

type MockLlmOptions = {
  answerText?: string;
  responder?: (requestBody: string) => string;
  statusCode?: number;
  rawBody?: string;
};

export function startMockLlmServer(options?: MockLlmOptions): {
  baseUrl: string;
  requests: LoggedRequest[];
  stop: () => void;
} {
  const requests: LoggedRequest[] = [];
  const defaultAnswer = options?.answerText ?? "Mock integration summary response.";
  const statusCode = options?.statusCode ?? 200;

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const body = await request.text();
      requests.push({
        method: request.method,
        path: url.pathname,
        body,
        headers: request.headers,
      });

      if (request.method === "POST" && url.pathname === "/chat/completions") {
        if (statusCode !== 200) {
          return new Response(options?.rawBody ?? "mock llm error", {
            status: statusCode,
            headers: { "content-type": "text/plain" },
          });
        }

        if (options?.rawBody !== undefined) {
          return new Response(options.rawBody, {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          });
        }

        const answerText = options?.responder?.(body) ?? defaultAnswer;
        const sseBody = [
          `data: ${JSON.stringify({ choices: [{ delta: { content: answerText } }] })}`,
          "data: [DONE]",
          "",
        ].join("\n");
        return new Response(sseBody, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      }

      return new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    },
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    requests,
    stop: () => server.stop(true),
  };
}
