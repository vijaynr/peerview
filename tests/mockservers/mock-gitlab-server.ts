type LoggedRequest = {
  method: string;
  path: string;
  query: string;
  body: string;
  headers: Headers;
};

type MockGitLabOptions = {
  projectPath?: string;
  branch: string;
  mrIid?: number;
  hasOpenMr?: boolean;
  targetBranch?: string;
  hasExistingMrForTarget?: boolean;
  compareDiff?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function startMockGitLabServer(options: MockGitLabOptions): {
  baseUrl: string;
  requests: LoggedRequest[];
  stop: () => void;
} {
  const projectPath = options.projectPath ?? "group/project";
  const encodedProject = encodeURIComponent(projectPath);
  const mrIid = options.mrIid ?? 7;
  const hasOpenMr = options.hasOpenMr ?? true;
  const targetBranch = options.targetBranch ?? "main";
  const hasExistingMrForTarget = options.hasExistingMrForTarget ?? false;
  const compareDiff = options.compareDiff ?? "@@ -1,1 +1,1 @@\n-old line\n+new line";
  const requests: LoggedRequest[] = [];

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const body = await request.text();
      requests.push({
        method: request.method,
        path: url.pathname,
        query: url.search,
        body,
        headers: request.headers,
      });

      if (
        request.method === "GET" &&
        url.pathname === `/api/v4/projects/${encodedProject}/merge_requests`
      ) {
        const sourceBranch = url.searchParams.get("source_branch");
        const requestedTargetBranch = url.searchParams.get("target_branch");

        if (
          sourceBranch === options.branch &&
          requestedTargetBranch === targetBranch &&
          hasExistingMrForTarget
        ) {
          return json([
            {
              iid: mrIid,
              title: "Existing MR",
              state: "opened",
              web_url: `https://gitlab.local/${projectPath}/-/merge_requests/${mrIid}`,
            },
          ]);
        }

        if (sourceBranch === options.branch && !requestedTargetBranch && hasOpenMr) {
          return json([
            {
              iid: mrIid,
              title: "Mock MR",
              state: "opened",
              web_url: `https://gitlab.local/${projectPath}/-/merge_requests/${mrIid}`,
            },
          ]);
        }
        return json([]);
      }

      if (
        request.method === "GET" &&
        url.pathname === `/api/v4/projects/${encodedProject}/repository/branches`
      ) {
        return json([{ name: targetBranch }, { name: options.branch }]);
      }

      if (
        request.method === "GET" &&
        url.pathname === `/api/v4/projects/${encodedProject}/repository/compare`
      ) {
        return json({
          diffs: [
            {
              diff: compareDiff,
            },
          ],
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}`
      ) {
        return json({
          iid: mrIid,
          title: "Mock MR",
          state: "opened",
          web_url: `https://gitlab.local/${projectPath}/-/merge_requests/${mrIid}`,
          description: "Mock merge request description",
          diff_refs: {
            base_sha: "base123",
            start_sha: "start123",
            head_sha: "head123",
          },
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/changes`
      ) {
        return json({
          changes: [
            {
              old_path: "src/app.ts",
              new_path: "src/app.ts",
              diff: "@@ -1,1 +1,1 @@\n-console.log('old')\n+console.log('new')",
            },
          ],
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/commits`
      ) {
        return json([
          {
            id: "abc123",
            title: "Mock commit",
            message: "Mock commit message",
          },
        ]);
      }

      if (
        request.method === "GET" &&
        url.pathname === `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/discussions`
      ) {
        return json([]);
      }

      if (
        request.method === "POST" &&
        url.pathname === `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/discussions`
      ) {
        return json({
          notes: [{ id: 901 }],
        });
      }

      if (
        request.method === "POST" &&
        url.pathname === `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}/notes`
      ) {
        return json({ id: 902, body: "ok" });
      }

      if (
        request.method === "POST" &&
        url.pathname === `/api/v4/projects/${encodedProject}/merge_requests`
      ) {
        return json({
          iid: mrIid,
          web_url: `https://gitlab.local/${projectPath}/-/merge_requests/${mrIid}`,
        });
      }

      if (
        request.method === "PUT" &&
        url.pathname === `/api/v4/projects/${encodedProject}/merge_requests/${mrIid}`
      ) {
        return json({
          iid: mrIid,
          web_url: `https://gitlab.local/${projectPath}/-/merge_requests/${mrIid}`,
        });
      }

      return json({ message: "Not found" }, 404);
    },
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    requests,
    stop: () => server.stop(true),
  };
}
