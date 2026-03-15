/**
 * Low-level HTTP client for the GitLab REST API.
 *
 * Handles authentication, base URL normalization, JSON encoding/decoding,
 * and uniform error reporting. All GitLabClient operations are built on
 * top of this class.
 */

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  /** When true, a non-2xx response is logged at trace level instead of error. */
  silent?: boolean;
}

export class GitLabApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly responseBody: string
  ) {
    super(`GitLab API ${status} on ${endpoint}: ${responseBody}`);
    this.name = "GitLabApiError";
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export class GitLabHttpClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {}, silent = false } = options;
    const url = `${this.baseUrl}${endpoint}`;

    this.log("debug", `${method} ${endpoint}`);

    const response = await fetch(url, {
      method,
      headers: {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      if (silent) {
        this.log("trace", `${method} ${endpoint} → ${response.status} (silent)`);
      } else {
        this.log("error", `${method} ${endpoint} → ${response.status}: ${responseBody}`);
      }
      throw new GitLabApiError(response.status, endpoint, responseBody);
    }

    this.log("trace", `${method} ${endpoint} → ${response.status}`);

    // Some DELETE endpoints return 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }

  async requestText(endpoint: string, options: RequestOptions = {}): Promise<string | null> {
    const { method = "GET", headers = {}, silent = false } = options;
    const url = `${this.baseUrl}${endpoint}`;

    this.log("debug", `${method} ${endpoint} (text)`);

    const response = await fetch(url, {
      method,
      headers: {
        "PRIVATE-TOKEN": this.token,
        ...headers,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const responseBody = await response.text();
      if (silent) {
        this.log("trace", `${method} ${endpoint} → ${response.status} (silent)`);
      } else {
        this.log("error", `${method} ${endpoint} → ${response.status}: ${responseBody}`);
      }
      throw new GitLabApiError(response.status, endpoint, responseBody);
    }

    return response.text();
  }

  get<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  patch<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body });
  }

  delete<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  private log(level: "debug" | "trace" | "error", message: string): void {
    // Use console in a level-appropriate way; integrations can replace this
    // by subclassing or wrapping GitLabHttpClient.
    if (level === "error") {
      console.error(`[gitlab] ${message}`);
    } else if (level === "debug") {
      // Only emit when DEBUG env is set to keep output clean by default
      if (process.env["DEBUG"]) console.debug(`[gitlab] ${message}`);
    }
    // trace is silently swallowed unless DEBUG is set
  }
}
