import { printCommandHelp, printError } from "@cr/ui";
import { getFlag, hasFlag } from "../cliHelpers.js";
import { startWebhookServer } from "@cr/webhook";

export async function runServeCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printCommandHelp([
      {
        title: "USAGE",
        lines: ["cr serve [options]"],
      },
      {
        title: "OPTIONS",
        lines: [
          "--webhook             Start a webhook server for GitLab MR events",
          "--mode <mode>         Mode: gitlab (default)",
          "--port, -p <number>   Port to listen on (default: 3000)",
          "--ssl-cert <path>     Path to SSL certificate (optional)",
          "--ssl-key <path>      Path to SSL private key (optional)",
          "--ssl-ca <path>       Path to SSL CA bundle (optional)",
          "--concurrency <num>   Max concurrent review jobs (default: 3)",
          "--queue-limit <num>   Max jobs in queue (default: 50)",
          "--timeout <ms>        Max time per review job (default: 600000)",
        ],
      },
      {
        title: "EXAMPLES",
        lines: [
          "cr serve --webhook",
          "cr serve --webhook --concurrency 5 --timeout 300000",
          "cr serve --webhook --port 8443 --ssl-cert ./cert.crt --ssl-key ./cert.key --ssl-ca ./ca.crt",
        ],
      },
    ]);
    return;
  }

  const isWebhook = hasFlag(args, "webhook");
  const mode = getFlag(args, "mode", "gitlab");
  const port = Number(getFlag(args, "port", "3000", "-p"));
  const sslCertPath = getFlag(args, "ssl-cert", "");
  const sslKeyPath = getFlag(args, "ssl-key", "");
  const sslCaPath = getFlag(args, "ssl-ca", "");

  const concurrency = getFlag(args, "concurrency", "");
  const queueLimit = getFlag(args, "queue-limit", "");
  const timeoutMs = getFlag(args, "timeout", "");

  if (!isWebhook) {
    printError("The 'cr serve' command currently requires the --webhook flag.");
    process.exitCode = 1;
    return;
  }

  if (mode !== "gitlab" && mode !== "reviewboard") {
    printError(`Unsupported mode '${mode}'. Currently 'gitlab' and 'reviewboard' are supported.`);
    process.exitCode = 1;
    return;
  }

  try {
    await startWebhookServer(port, {
      sslCertPath,
      sslKeyPath,
      sslCaPath,
      webhookConcurrency: concurrency ? Number.parseInt(concurrency, 10) : undefined,
      webhookQueueLimit: queueLimit ? Number.parseInt(queueLimit, 10) : undefined,
      webhookJobTimeoutMs: timeoutMs ? Number.parseInt(timeoutMs, 10) : undefined,
      mode,
    });
  } catch (err) {
    printError(
      `Failed to start webhook server: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exitCode = 1;
  }
}
