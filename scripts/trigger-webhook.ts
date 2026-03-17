/**
 * Manual test script to trigger the CR server webhook endpoints.
 * Usage: bun run scripts/trigger-webhook.ts [port]
 */

const port = process.argv[2] || "3000";
const url = `http://localhost:${port}/`;

const payload = {
  object_kind: "merge_request",
  event_type: "merge_request",
  user: {
    name: "Test User",
    username: "testuser",
  },
  project: {
    id: 118153,
    name: "project-118153",
    path_with_namespace: "org/project-118153",
    web_url: "https://gitlab.example.com/org/project-118153",
  },
  object_attributes: {
    action: "update", // Can be 'open', 'update', 'reopen'
    iid: 7, // MR IID
    title: "Test Merge Request",
    state: "opened",
    url: "https://gitlab.example.com/org/project-118153/-/merge_requests/7",
    oldrev: "abc123456", // Include oldrev to satisfy the 'update' commit check
  },
};

console.log(`Sending mock GitLab MR event to ${url}...`);

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gitlab-Event": "Merge Request Hook",
      "X-Gitlab-Token": process.env.GITLAB_WEBHOOK_SECRET || "novell",
    },
    body: JSON.stringify(payload),
  });

  console.log(`Response Status: ${response.status} ${response.statusText}`);
  const text = await response.text();
  console.log(`Response Body: ${text}`);
} catch (error) {
  console.error("Error sending request:", error instanceof Error ? error.message : String(error));
}
