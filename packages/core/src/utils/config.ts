import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { CRConfig } from "../types/config.js";
import { CR_CONF_KEY_PATH, CR_CONF_PATH } from "./paths.js";

const configSchema = z.object({
  openaiApiUrl: z.string(),
  openaiApiKey: z.string(),
  openaiModel: z.string(),
  useCustomStreaming: z.boolean(),
  defaultReviewAgents: z.array(z.string()).optional(),
  gitlabUrl: z.string(),
  gitlabKey: z.string(),
  githubToken: z.string().optional(),
  svnRepositoryUrl: z.string().optional(),
  svnUsername: z.string().optional(),
  svnPassword: z.string().optional(),
  rbUrl: z.string().optional(),
  rbToken: z.string().optional(),
  gitlabWebhookSecret: z.string().optional(),
  githubWebhookSecret: z.string().optional(),
  rbWebhookSecret: z.string().optional(),
  sslCertPath: z.string().optional(),
  sslKeyPath: z.string().optional(),
  sslCaPath: z.string().optional(),
  webhookConcurrency: z.number().int().min(1).optional(),
  webhookQueueLimit: z.number().int().min(1).optional(),
  webhookJobTimeoutMs: z.number().int().min(1000).optional(),
  terminalTheme: z.enum(["auto", "dark", "light"]).optional(),
});

const crSection = "cr";
const ENCRYPTED_SECRET_PREFIX = "enc:v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_BYTES = 32;
const ENCRYPTION_IV_BYTES = 12;

function parseIni(content: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let current = "";
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      current = line.slice(1, -1).trim();
      if (!sections[current]) {
        sections[current] = {};
      }
      continue;
    }
    const idx = line.indexOf("=");
    if (idx <= 0 || !current) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    sections[current] ??= {};
    sections[current][key] = value;
  }
  return sections;
}

function toIni(data: Record<string, Record<string, string>>): string {
  return Object.entries(data)
    .map(([section, values]) => {
      const body = Object.entries(values)
        .map(([k, v]) => `${k} = ${v}`)
        .join("\n");
      return `[${section}]\n${body}`;
    })
    .join("\n\n")
    .concat("\n");
}

function isEncryptedSecret(value: string | undefined): value is string {
  return Boolean(value?.startsWith(`${ENCRYPTED_SECRET_PREFIX}:`));
}

export function encryptConfigSecret(value: string, key: Buffer): string {
  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTED_SECRET_PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptConfigSecret(value: string, key: Buffer): string {
  if (!isEncryptedSecret(value)) {
    return value;
  }

  const [, version, ivBase64, tagBase64, encryptedBase64] = value.split(":");
  if (version !== "v1" || !ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error("Unsupported encrypted config secret format.");
  }

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}

async function loadOrCreateConfigEncryptionKey(): Promise<Buffer> {
  if (existsSync(CR_CONF_KEY_PATH)) {
    const key = Buffer.from((await fs.readFile(CR_CONF_KEY_PATH, "utf-8")).trim(), "base64");
    if (key.length !== ENCRYPTION_KEY_BYTES) {
      throw new Error("Invalid CR config encryption key.");
    }
    return key;
  }

  const key = randomBytes(ENCRYPTION_KEY_BYTES);
  await fs.mkdir(path.dirname(CR_CONF_KEY_PATH), { recursive: true });
  await fs.writeFile(CR_CONF_KEY_PATH, key.toString("base64"), { encoding: "utf-8", mode: 0o600 });
  return key;
}

async function maybeDecryptConfigSecret(value: string | undefined): Promise<string | undefined> {
  if (!value) {
    return undefined;
  }
  if (!isEncryptedSecret(value)) {
    return value;
  }

  return decryptConfigSecret(value, await loadOrCreateConfigEncryptionKey());
}

async function maybeEncryptConfigSecret(value: string | undefined): Promise<string | undefined> {
  if (!value) {
    return undefined;
  }

  return encryptConfigSecret(value, await loadOrCreateConfigEncryptionKey());
}

export async function loadCRConfig(): Promise<Partial<CRConfig>> {
  if (!existsSync(CR_CONF_PATH)) {
    return {};
  }

  const raw = await fs.readFile(CR_CONF_PATH, "utf-8");
  const ini = parseIni(raw);
  const section = ini[crSection] ?? {};

  const parsed = {
    openaiApiUrl: section.openai_api_url ?? "",
    openaiApiKey: await maybeDecryptConfigSecret(
      section.openai_api_key_enc ?? section.openai_api_key ?? ""
    ),
    openaiModel: section.openai_model ?? "",
    useCustomStreaming: (section.use_custom_streaming ?? "false").toLowerCase() === "true",
    defaultReviewAgents: section.default_review_agents
      ? section.default_review_agents
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined,
    gitlabUrl: section.gitlab_url ?? "",
    gitlabKey: await maybeDecryptConfigSecret(section.gitlab_key_enc ?? section.gitlab_key ?? ""),
    svnRepositoryUrl: section.svn_repository_url ?? section.svn_guidelines_base_url ?? undefined,
    svnUsername: section.svn_username ?? undefined,
    svnPassword: await maybeDecryptConfigSecret(
      section.svn_password_enc ?? section.svn_password ?? undefined
    ),
    rbUrl: section.rb_url ?? undefined,
    rbToken: await maybeDecryptConfigSecret(section.rb_token_enc ?? section.rb_token ?? undefined),
    gitlabWebhookSecret: await maybeDecryptConfigSecret(
      section.gitlab_webhook_secret_enc ?? section.gitlab_webhook_secret ?? undefined
    ),
    rbWebhookSecret: await maybeDecryptConfigSecret(
      section.rb_webhook_secret_enc ?? section.rb_webhook_secret ?? undefined
    ),
    sslCertPath: section.ssl_cert_path ?? undefined,
    sslKeyPath: section.ssl_key_path ?? undefined,
    sslCaPath: section.ssl_ca_path ?? undefined,
    webhookConcurrency: section.webhook_concurrency
      ? Number.parseInt(section.webhook_concurrency, 10)
      : undefined,
    webhookQueueLimit: section.webhook_queue_limit
      ? Number.parseInt(section.webhook_queue_limit, 10)
      : undefined,
    webhookJobTimeoutMs: section.webhook_job_timeout_ms
      ? Number.parseInt(section.webhook_job_timeout_ms, 10)
      : undefined,
    terminalTheme: section.terminal_theme as "auto" | "dark" | "light" | undefined,
  };

  return configSchema.partial().parse(parsed);
}

export async function readCRConfigContents(): Promise<string | null> {
  if (!existsSync(CR_CONF_PATH)) {
    return null;
  }

  return fs.readFile(CR_CONF_PATH, "utf-8");
}

export async function saveCRConfig(config: CRConfig): Promise<void> {
  const parsed = configSchema.parse(config);
  const encryptedSecrets = {
    openaiApiKey: await maybeEncryptConfigSecret(parsed.openaiApiKey),
    gitlabKey: await maybeEncryptConfigSecret(parsed.gitlabKey),
    svnPassword: await maybeEncryptConfigSecret(parsed.svnPassword),
    rbToken: await maybeEncryptConfigSecret(parsed.rbToken),
    gitlabWebhookSecret: await maybeEncryptConfigSecret(parsed.gitlabWebhookSecret),
    rbWebhookSecret: await maybeEncryptConfigSecret(parsed.rbWebhookSecret),
  };

  const output = toIni({
    [crSection]: {
      openai_api_url: parsed.openaiApiUrl,
      ...(encryptedSecrets.openaiApiKey && { openai_api_key_enc: encryptedSecrets.openaiApiKey }),
      openai_model: parsed.openaiModel,
      use_custom_streaming: parsed.useCustomStreaming ? "true" : "false",
      ...(parsed.defaultReviewAgents?.length && {
        default_review_agents: parsed.defaultReviewAgents.join(","),
      }),
      gitlab_url: parsed.gitlabUrl,
      ...(encryptedSecrets.gitlabKey && { gitlab_key_enc: encryptedSecrets.gitlabKey }),
      ...(parsed.svnRepositoryUrl && {
        svn_repository_url: parsed.svnRepositoryUrl,
      }),
      ...(parsed.svnUsername && { svn_username: parsed.svnUsername }),
      ...(encryptedSecrets.svnPassword && { svn_password_enc: encryptedSecrets.svnPassword }),
      ...(parsed.rbUrl && { rb_url: parsed.rbUrl }),
      ...(encryptedSecrets.rbToken && { rb_token_enc: encryptedSecrets.rbToken }),
      ...(encryptedSecrets.gitlabWebhookSecret && {
        gitlab_webhook_secret_enc: encryptedSecrets.gitlabWebhookSecret,
      }),
      ...(encryptedSecrets.rbWebhookSecret && {
        rb_webhook_secret_enc: encryptedSecrets.rbWebhookSecret,
      }),
      ...(parsed.sslCertPath && { ssl_cert_path: parsed.sslCertPath }),
      ...(parsed.sslKeyPath && { ssl_key_path: parsed.sslKeyPath }),
      ...(parsed.sslCaPath && { ssl_ca_path: parsed.sslCaPath }),
      ...(parsed.webhookConcurrency && { webhook_concurrency: String(parsed.webhookConcurrency) }),
      ...(parsed.webhookQueueLimit && { webhook_queue_limit: String(parsed.webhookQueueLimit) }),
      ...(parsed.webhookJobTimeoutMs && {
        webhook_job_timeout_ms: String(parsed.webhookJobTimeoutMs),
      }),
      ...(parsed.terminalTheme && { terminal_theme: parsed.terminalTheme }),
    },
  });

  await fs.writeFile(CR_CONF_PATH, output, "utf-8");
}

export function envOrConfig(
  envKey: string,
  configValue: string | undefined,
  fallback = ""
): string {
  const envValue = process.env[envKey];
  if (envValue !== undefined && envValue !== "") {
    return envValue;
  }
  return configValue ?? fallback;
}
