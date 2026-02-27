/**
 * Network error detection and formatting utilities.
 */

export interface FormattedError {
  title: string;
  body: string;
}

/**
 * Detects known network errors and returns a formatted error message.
 * Returns null if the error is not recognized as a network error.
 */
export function formatKnownNetworkError(message: string): FormattedError | null {
  const normalized = message.toLowerCase();

  const timeoutHints = ["timeout", "timed out", "etimedout", "econnaborted"];
  if (timeoutHints.some((hint) => normalized.includes(hint))) {
    return {
      title: "Network Timeout",
      body: [
        "Request timed out while contacting CR/OpenAI or GitLab.",
        "Please verify VPN/network connectivity and retry.",
        "",
        `Details: ${message}`,
      ].join("\n"),
    };
  }

  const networkHints = [
    "fetch failed",
    "network",
    "enotfound",
    "eai_again",
    "econnrefused",
    "connection reset",
    "socket hang up",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
  ];
  if (networkHints.some((hint) => normalized.includes(hint))) {
    return {
      title: "Network Request Failed",
      body: [
        "Unable to reach CR/OpenAI or GitLab.",
        "Check endpoint URL/token configuration and network access, then retry.",
        "",
        `Details: ${message}`,
      ].join("\n"),
    };
  }

  return null;
}
