import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BrainCircuit, GitBranch, Webhook } from "lucide";
import type {
  DashboardData,
  ReviewAgentOption,
  TerminalTheme,
} from "../types.js";
import type { TestConnectionResult } from "../api.js";
import { isDesktop } from "../desktop-bridge.js";
import "./cr-icon.js";
import "./cr-config-input.js";

const sectionEyebrowClass =
  "text-[0.72rem] font-semibold tracking-[0.08em] text-base-content/40";

type ConfigDraft = {
  openaiApiUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  useCustomStreaming: boolean;
  defaultReviewAgents: string[];
  gitlabUrl: string;
  gitlabKey: string;
  githubUrl: string;
  githubToken: string;
  rbUrl: string;
  rbToken: string;
  gitlabWebhookSecret: string;
  githubWebhookSecret: string;
  rbWebhookSecret: string;
  sslCertPath: string;
  sslKeyPath: string;
  sslCaPath: string;
  webhookConcurrency: string;
  webhookQueueLimit: string;
  webhookJobTimeoutMs: string;
  terminalTheme: TerminalTheme | "";
  gitlabEnabled: boolean;
  githubEnabled: boolean;
  reviewboardEnabled: boolean;
  gitlabWebhookEnabled: boolean;
  githubWebhookEnabled: boolean;
  reviewboardWebhookEnabled: boolean;
};

type TestResults = Partial<
  Record<
    "gitlab" | "github" | "reviewboard" | "openai",
    TestConnectionResult & { testing?: boolean }
  >
>;

@customElement("cr-settings-page")
export class CrSettingsPage extends LitElement {
  @property({ attribute: false }) configDraft!: ConfigDraft;
  @property({ attribute: false }) configBaseline!: ConfigDraft;
  @property({ attribute: false }) dashboard: DashboardData | null = null;
  @property({ attribute: false }) agentOptions: ReviewAgentOption[] = [];
  @property({ attribute: false }) testResults: TestResults = {};
  @property({ type: Boolean }) savingConfig = false;
  @property({ type: Boolean }) loadingConfig = false;

  override createRenderRoot() {
    return this;
  }

  private get configDirty() {
    return (
      JSON.stringify(this.configDraft) !==
      JSON.stringify(this.configBaseline)
    );
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  private handleField<K extends keyof ConfigDraft>(
    key: K,
    value: ConfigDraft[K]
  ) {
    this.emit("config-field-change", { key, value });
  }

  private handleAgentDefaultToggle(value: string, checked: boolean) {
    this.emit("agent-default-toggle", { value, checked });
  }

  private renderTestResult(
    provider: "gitlab" | "github" | "reviewboard" | "openai"
  ) {
    const r = this.testResults[provider];
    if (!r || r.testing) return "";
    return html`
      <span class="text-sm ${r.ok ? "text-success" : "text-error"}">
        ${r.ok ? "✓" : "✗"} ${r.message}
      </span>
    `;
  }

  private renderTestButton(
    provider: "gitlab" | "github" | "reviewboard" | "openai"
  ) {
    const testing = this.testResults[provider]?.testing;
    return html`
      <button
        class="btn btn-outline btn-sm gap-1.5"
        type="button"
        ?disabled=${testing}
        @click=${() => this.emit("test-connection", provider)}
      >
        ${testing
          ? html`<span
              class="loading loading-spinner loading-xs"
            ></span>`
          : ""}
        Test connection
      </button>
    `;
  }

  private renderProviderBlock(
    name: string,
    enabledKey: "gitlabEnabled" | "githubEnabled" | "reviewboardEnabled",
    testKey: "gitlab" | "github" | "reviewboard",
    configured: boolean | undefined,
    fields: Array<{
      label: string;
      note: string;
      key: keyof ConfigDraft;
      type?: string;
    }>
  ) {
    return html`
      <div
        class="rounded-xl border border-base-300 bg-base-200 divide-y divide-base-300"
      >
        <div
          class="px-6 py-4 flex items-center justify-between gap-3 flex-wrap"
        >
          <div class="flex items-center gap-3">
            <label class="cursor-pointer flex items-center gap-2.5">
              <input
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
                .checked=${this.configDraft[enabledKey] as boolean}
                @change=${(e: Event) =>
                  this.handleField(
                    enabledKey,
                    (e.target as HTMLInputElement).checked
                  )}
              />
              <span class="text-sm font-semibold">${name}</span>
            </label>
            <span
              class="badge ${configured
                ? "badge-success"
                : "badge-ghost"} badge-sm"
            >
              ${configured ? "Connected" : "Not configured"}
            </span>
          </div>
          ${this.renderTestButton(testKey)}
        </div>
        ${this.testResults[testKey] && !this.testResults[testKey]?.testing
          ? html`
              <div class="px-6 py-3">
                ${this.renderTestResult(testKey)}
              </div>
            `
          : ""}
        <div class="px-6 py-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            ${fields.map(
              (f) => html`
                <cr-config-input
                  .label=${f.label}
                  .note=${f.note}
                  .value=${String(this.configDraft[f.key] ?? "")}
                  .type=${f.type || "text"}
                  @value-change=${(e: CustomEvent) =>
                    this.handleField(
                      f.key,
                      e.detail as ConfigDraft[typeof f.key]
                    )}
                ></cr-config-input>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }

  private renderWebhookToggle(
    name: string,
    key:
      | "gitlabWebhookEnabled"
      | "githubWebhookEnabled"
      | "reviewboardWebhookEnabled",
    route: string,
    note: string
  ) {
    const enabled = this.configDraft[key];

    return html`
      <div
        class="rounded-xl border border-base-300 bg-base-100/60 px-4 py-4 flex flex-col gap-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex flex-col gap-1">
            <div class="text-sm font-semibold">${name}</div>
            <div class="text-xs text-base-content/55">${note}</div>
          </div>
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-primary"
            .checked=${enabled}
            @change=${(e: Event) =>
              this.handleField(key, (e.target as HTMLInputElement).checked)}
          />
        </div>
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <code class="text-xs px-2.5 py-1.5 rounded-lg bg-base-300/60"
            >${route}</code
          >
          <span class="badge ${enabled ? "badge-success" : "badge-ghost"} badge-sm">
            ${enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>
    `;
  }

  render() {
    if (this.loadingConfig && !this.dashboard) {
      return html`
        <div class="cr-fade-in flex flex-col gap-10 pb-32 md:pb-28">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
            <p class="mt-1 text-sm text-base-content/50">
              Loading configuration…
            </p>
          </div>
          <div class="flex flex-col gap-6">
            ${[1, 2, 3].map(
              () =>
                html`<div class="cr-skeleton h-32 rounded-xl"></div>`
            )}
          </div>
        </div>
      `;
    }

    const gitlabConfigured = this.dashboard?.config?.gitlab?.configured;
    const githubConfigured = this.dashboard?.config?.github?.configured;
    const reviewBoardConfigured =
      this.dashboard?.config?.reviewboard?.configured;

    return html`
      <div class="cr-fade-in flex flex-col gap-10 pb-32 md:pb-28">
        <!-- Page header -->
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
          <p class="mt-1 text-sm text-base-content/50">
            Configure providers, AI runtime, webhooks, and server options.
          </p>
        </div>

        <!-- AI Section -->
        <section class="flex flex-col gap-5">
          <div class="flex items-center gap-2.5">
            <cr-icon .icon=${BrainCircuit} .size=${18}></cr-icon>
            <h2 class="text-lg font-semibold">AI</h2>
            <span
              class="badge ${this.dashboard?.config?.openai?.configured
                ? "badge-success"
                : "badge-error"} badge-sm ml-1"
            >
              ${this.dashboard?.config?.openai?.configured
                ? "Ready"
                : "Needs setup"}
            </span>
          </div>

          <div
            class="rounded-xl border border-base-300 bg-base-200 divide-y divide-base-300"
          >
            <!-- Model & API -->
            <div class="px-6 py-5 flex flex-col gap-5">
              <div>
                <div class="text-sm font-semibold">Model &amp; API</div>
                <div class=${sectionEyebrowClass}>
                  OpenAI-compatible endpoint for all AI workflows
                </div>
              </div>
              <div
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                <cr-config-input
                  label="API URL"
                  note="Compatible base URL for review, summarize, and chat."
                  .value=${this.configDraft.openaiApiUrl}
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("openaiApiUrl", e.detail)}
                ></cr-config-input>
                <cr-config-input
                  label="API key"
                  note="Stored in CR config for all AI workflows."
                  .value=${this.configDraft.openaiApiKey}
                  type="password"
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("openaiApiKey", e.detail)}
                ></cr-config-input>
                <cr-config-input
                  label="Model"
                  note="Default model name for CR review workflows."
                  .value=${this.configDraft.openaiModel}
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("openaiModel", e.detail)}
                ></cr-config-input>
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                ${this.renderTestButton("openai")}
                ${this.renderTestResult("openai")}
              </div>
            </div>

            <!-- Options -->
            <div class="px-6 py-5 flex flex-col gap-5">
              <div>
                <div class="text-sm font-semibold">Options</div>
                <div class=${sectionEyebrowClass}>
                  Runtime behaviour and terminal rendering
                </div>
              </div>
              <div
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                <div class="form-control gap-1">
                  <label class="label py-0"
                    ><span class="label-text text-sm font-medium"
                      >Terminal theme</span
                    ></label
                  >
                  <div class="text-xs text-base-content/50 mb-1">
                    Optional override for terminal-facing surfaces.
                  </div>
                  <select
                    class="select select-bordered select-sm"
                    .value=${this.configDraft.terminalTheme}
                    @change=${(e: Event) =>
                      this.handleField(
                        "terminalTheme",
                        (e.target as HTMLSelectElement).value as
                          | TerminalTheme
                          | ""
                      )}
                  >
                    <option value="">Auto</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>
              <label class="cursor-pointer flex items-start gap-3">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm mt-0.5"
                  .checked=${this.configDraft.useCustomStreaming}
                  @change=${(e: Event) =>
                    this.handleField(
                      "useCustomStreaming",
                      (e.target as HTMLInputElement).checked
                    )}
                />
                <div>
                  <div class="text-sm font-medium">
                    Use custom streaming
                  </div>
                  <div class="text-xs text-base-content/50 mt-0.5">
                    Enable CR's custom SSE streaming instead of the default
                    SDK.
                  </div>
                </div>
              </label>
            </div>

            <!-- Default review agents -->
            <div class="px-6 py-5 flex flex-col gap-4">
              <div>
                <div class="text-sm font-semibold">
                  Default review agents
                </div>
                <div class=${sectionEyebrowClass}>
                  Pre-selected agents when opening the review workflow
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                ${this.agentOptions.map(
                  (option) => html`
                    <label
                      class="cursor-pointer flex items-center gap-1.5 badge badge-ghost badge-lg"
                    >
                      <input
                        type="checkbox"
                        class="checkbox checkbox-xs"
                        .checked=${this.configDraft.defaultReviewAgents.includes(
                          option.value
                        )}
                        @change=${(e: Event) =>
                          this.handleAgentDefaultToggle(
                            option.value,
                            (e.target as HTMLInputElement).checked
                          )}
                      />
                      ${option.title}
                    </label>
                  `
                )}
              </div>
            </div>
          </div>
        </section>

        <!-- Source Control Section -->
        <section class="flex flex-col gap-5">
          <div class="flex items-center gap-2.5 flex-wrap">
            <cr-icon .icon=${GitBranch} .size=${18}></cr-icon>
            <h2 class="text-lg font-semibold">Source Control</h2>
            <div class="flex gap-1.5 ml-1 flex-wrap">
              <span
                class="badge ${gitlabConfigured
                  ? "badge-success"
                  : "badge-error"} badge-sm"
                >GitLab</span
              >
              <span
                class="badge ${githubConfigured
                  ? "badge-success"
                  : "badge-error"} badge-sm"
                >GitHub</span
              >
              <span
                class="badge ${reviewBoardConfigured
                  ? "badge-success"
                  : "badge-error"} badge-sm"
                >Review Board</span
              >
            </div>
          </div>

          ${this.renderProviderBlock(
            "GitLab",
            "gitlabEnabled",
            "gitlab",
            gitlabConfigured,
            [
              {
                label: "GitLab URL",
                note: "Base URL for merge request and inline comment APIs.",
                key: "gitlabUrl",
              },
              {
                label: "GitLab token",
                note: "Private token for CR GitLab workflows.",
                key: "gitlabKey",
                type: "password",
              },
            ]
          )}
          ${this.renderProviderBlock(
            "GitHub",
            "githubEnabled",
            "github",
            githubConfigured,
            [
              {
                label: "GitHub URL",
                note: "Leave blank for github.com. Set for GitHub Enterprise.",
                key: "githubUrl",
              },
              {
                label: "GitHub token",
                note: "PAT to list pull requests and post review comments.",
                key: "githubToken",
                type: "password",
              },
            ]
          )}
          ${this.renderProviderBlock(
            "Review Board",
            "reviewboardEnabled",
            "reviewboard",
            reviewBoardConfigured,
            [
              {
                label: "Review Board URL",
                note: "Base URL for review request and diff APIs.",
                key: "rbUrl",
              },
              {
                label: "Review Board token",
                note: "Token for review publishing and queue access.",
                key: "rbToken",
                type: "password",
              },
            ]
          )}
        </section>

        <!-- Automation Section (hidden in desktop mode) -->
        ${isDesktop() ? html`` : html`
        <section class="flex flex-col gap-5">
          <div class="flex items-center gap-2.5">
            <cr-icon .icon=${Webhook} .size=${18}></cr-icon>
            <h2 class="text-lg font-semibold">Automation</h2>
            <span
              class="badge ${this.dashboard?.config?.webhook?.sslEnabled
                ? "badge-success"
                : "badge-ghost"} badge-sm ml-1"
            >
              ${this.dashboard?.config?.webhook?.sslEnabled
                ? "SSL enabled"
                : "HTTP only"}
            </span>
          </div>

          <div
            class="rounded-xl border border-base-300 bg-base-200 divide-y divide-base-300"
          >
            <!-- Webhook secrets -->
            <div class="px-6 py-5 flex flex-col gap-5">
              <div>
                <div class="text-sm font-semibold">Webhook routes</div>
                <div class=${sectionEyebrowClass}>
                  Turn incoming automation on or off per provider without
                  disabling the provider workspace itself
                </div>
              </div>
              <div
                class="grid grid-cols-1 lg:grid-cols-3 gap-4"
              >
                ${this.renderWebhookToggle(
                  "GitLab webhook",
                  "gitlabWebhookEnabled",
                  "/webhook/gitlab",
                  "Accept merge request events from GitLab."
                )}
                ${this.renderWebhookToggle(
                  "GitHub webhook",
                  "githubWebhookEnabled",
                  "/webhook/github",
                  "Accept pull request events from GitHub or GitHub Enterprise."
                )}
                ${this.renderWebhookToggle(
                  "Review Board webhook",
                  "reviewboardWebhookEnabled",
                  "/webhook/reviewboard",
                  "Accept review_request_published events from Review Board."
                )}
              </div>
            </div>

            <!-- Webhook secrets -->
            <div class="px-6 py-5 flex flex-col gap-5">
              <div>
                <div class="text-sm font-semibold">Webhook secrets</div>
                <div class=${sectionEyebrowClass}>
                  Optional shared secrets to validate incoming webhook
                  payloads
                </div>
              </div>
              <div
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                <cr-config-input
                  label="GitLab webhook secret"
                  note="Shared secret for GitLab webhook events."
                  .value=${this.configDraft.gitlabWebhookSecret}
                  type="password"
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("gitlabWebhookSecret", e.detail)}
                ></cr-config-input>
                <cr-config-input
                  label="GitHub webhook secret"
                  note="Shared secret for GitHub webhook events."
                  .value=${this.configDraft.githubWebhookSecret}
                  type="password"
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("githubWebhookSecret", e.detail)}
                ></cr-config-input>
                <cr-config-input
                  label="Review Board webhook secret"
                  note="Shared secret for Review Board webhook events."
                  .value=${this.configDraft.rbWebhookSecret}
                  type="password"
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("rbWebhookSecret", e.detail)}
                ></cr-config-input>
              </div>
            </div>

            <!-- Queue settings -->
            <div class="px-6 py-5 flex flex-col gap-5">
              <div>
                <div class="text-sm font-semibold">Queue settings</div>
                <div class=${sectionEyebrowClass}>
                  Control parallelism, backlog size, and job timeouts
                </div>
              </div>
              <div
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                <cr-config-input
                  label="Concurrency"
                  note="Number of parallel webhook jobs."
                  .value=${this.configDraft.webhookConcurrency}
                  input-mode="numeric"
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("webhookConcurrency", e.detail)}
                ></cr-config-input>
                <cr-config-input
                  label="Queue limit"
                  note="Max queued jobs before rejection."
                  .value=${this.configDraft.webhookQueueLimit}
                  input-mode="numeric"
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("webhookQueueLimit", e.detail)}
                ></cr-config-input>
                <cr-config-input
                  label="Timeout (ms)"
                  note="Per-job execution timeout."
                  .value=${this.configDraft.webhookJobTimeoutMs}
                  input-mode="numeric"
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("webhookJobTimeoutMs", e.detail)}
                ></cr-config-input>
              </div>
            </div>

            <!-- SSL -->
            <div class="px-6 py-5 flex flex-col gap-5">
              <div>
                <div class="text-sm font-semibold">SSL / HTTPS</div>
                <div class=${sectionEyebrowClass}>
                  Certificate paths for enabling HTTPS on the server
                </div>
              </div>
              <div
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                <cr-config-input
                  label="SSL cert path"
                  note="Certificate file path for HTTPS."
                  .value=${this.configDraft.sslCertPath}
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("sslCertPath", e.detail)}
                ></cr-config-input>
                <cr-config-input
                  label="SSL key path"
                  note="Private key file path for HTTPS."
                  .value=${this.configDraft.sslKeyPath}
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("sslKeyPath", e.detail)}
                ></cr-config-input>
                <cr-config-input
                  label="SSL CA path"
                  note="CA file path for custom trust chain."
                  .value=${this.configDraft.sslCaPath}
                  @value-change=${(e: CustomEvent) =>
                    this.handleField("sslCaPath", e.detail)}
                ></cr-config-input>
              </div>
            </div>
          </div>
        </section>
        `}
      </div>

      <!-- Sticky footer -->
      <div
        class="cr-settings-footer fixed bottom-0 bg-base-200/95 backdrop-blur-sm border-t border-base-300 z-20"
      >
        <div class="cr-settings-footer__inner">
          <div class="cr-settings-footer__status text-xs text-base-content/50">
            ${this.configDirty
              ? html`<span class="text-warning font-semibold"
                  >● Unsaved changes</span
                >`
              : ""}
          </div>
          <div class="cr-settings-footer__actions">
            <button
              class="btn btn-ghost btn-sm"
              type="button"
              ?disabled=${this.savingConfig || !this.configDirty}
              @click=${() => this.emit("config-reset")}
            >
              Reset
            </button>
            <button
              class="btn btn-primary btn-sm gap-1.5"
              type="button"
              ?disabled=${this.savingConfig || !this.configDirty}
              @click=${() => this.emit("config-save")}
            >
              ${this.savingConfig
                ? html`<span
                    class="loading loading-spinner loading-xs"
                  ></span>`
                : ""}
              Save configuration
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
