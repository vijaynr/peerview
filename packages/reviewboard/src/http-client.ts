/**
 * Low-level HTTP client for the Review Board REST API.
 *
 * Review Board uses:
 *  - GET  → JSON responses wrapped in { stat: "ok", <resource>: ... }
 *  - POST/PUT → form-encoded or multipart bodies
 *  - Raw diff endpoint → Accept: text/x-patch, returns plain text
 *
 * Authentication is either:
 *  - API token:  `Authorization: token <token>` (default)
 *  - Basic auth: `Authorization: Basic base64(username:token)` when username provided
 */

export class ReviewBoardApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    public readonly responseBody: string
  ) {
    super(`Review Board API ${status} on ${endpoint}: ${responseBody}`);
    this.name = "ReviewBoardApiError";
  }
}

function isStatFail(data: unknown): data is { stat: "fail"; err?: { msg?: string } } {
  return Boolean(
    data &&
      typeof data === "object" &&
      "stat" in data &&
      (data as { stat?: unknown }).stat === "fail"
  );
}

function buildAuthHeader(token: string, username?: string): string {
  if (username) {
    return `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`;
  }
  return token.toLowerCase().startsWith("token ") ? token : `token ${token}`;
}

export class ReviewBoardHttpClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly username?: string;

  constructor(baseUrl: string, token: string, username?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
    this.username = username;
  }

  /** Resolves an endpoint (relative or absolute) to a full URL. */
  private resolveUrl(endpoint: string): string {
    return endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
  }

  private authHeader(): string {
    return buildAuthHeader(this.token, this.username);
  }

  /**
   * Makes a request that expects a JSON response.
   * Throws `ReviewBoardApiError` on non-2xx status or `stat: "fail"` body.
   */
  async requestJSON<T>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<T> {
    const url = this.resolveUrl(endpoint);

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.authHeader(),
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ReviewBoardApiError(response.status, endpoint, body);
    }

    const data: unknown = await response.json();
    if (isStatFail(data)) {
      const msg = (data as { err?: { msg?: string } }).err?.msg ?? JSON.stringify(data);
      throw new ReviewBoardApiError(response.status, endpoint, msg);
    }

    return data as T;
  }

  /**
   * Makes a form-encoded POST or PUT request.
   */
  async requestFormEncoded<T>(
    endpoint: string,
    method: "POST" | "PUT",
    params: Record<string, string>
  ): Promise<T> {
    return this.requestJSON<T>(endpoint, {
      method,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
  }

  /**
   * Makes a multipart/form-data POST request.
   */
  async requestMultipart<T>(endpoint: string, form: FormData): Promise<T> {
    return this.requestJSON<T>(endpoint, {
      method: "POST",
      body: form,
    });
  }

  /**
   * Fetches a raw text response (used for diff downloads).
   * Sends `Accept: text/x-patch`.
   */
  async requestText(endpoint: string): Promise<string> {
    const url = this.resolveUrl(endpoint);

    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader(),
        Accept: "text/x-patch",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ReviewBoardApiError(response.status, endpoint, body);
    }

    return response.text();
  }
}
