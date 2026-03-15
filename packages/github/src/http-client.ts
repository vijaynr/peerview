/**
 * Low-level HTTP client for the GitHub REST API.
 *
 * Handles authentication, JSON encoding/decoding, and uniform error reporting.
 * All GitHubClient operations are built on top of this class.
 */

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** When true, a 404 response returns null instead of throwing. */
  notFoundReturnsNull?: boolean;
}

export class GitHubApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly responseBody: string
  ) {
    super(`GitHub API ${status} on ${endpoint}: ${responseBody}`);
    this.name = "GitHubApiError";
  }
}

const GITHUB_API_BASE = "https://api.github.com";

export class GitHubHttpClient {
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(token: string, baseUrl: string = GITHUB_API_BASE) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {}, notFoundReturnsNull = false } = options;
    const url = `${this.baseUrl}${endpoint}`;

    this.log("debug", `${method} ${endpoint}`);

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CR-CLI",
        "Content-Type": "application/json",
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 404 && notFoundReturnsNull) {
      return null as unknown as T;
    }

    if (!response.ok) {
      const responseBody = await response.text();
      this.log("error", `${method} ${endpoint} → ${response.status}: ${responseBody}`);
      throw new GitHubApiError(response.status, endpoint, responseBody);
    }

    this.log("trace", `${method} ${endpoint} → ${response.status}`);

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
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
    if (level === "error") {
      console.error(`[github] ${message}`);
    } else if (level === "debug" && process.env["DEBUG"]) {
      console.debug(`[github] ${message}`);
    }
  }
}
