import path from "node:path";
import {
  PV_CONF_PATH,
  type CRConfig,
  defaultConfig,
  initializeCRHome,
  loadPVConfig,
  repoRootFromModule,
  type RpiTarget,
  type SpecTarget,
  saveCRConfig,
  setupRpi,
  setupSpecs,
} from "@pv/core";
import {
  createSpinner,
  type LiveController,
  printDivider,
  printEmptyLine,
  printCommandHelp,
  printError,
  printInfo,
  printSuccess,
  printWarning,
  printWorkflowOutput,
  promptWithFrame,
  runLiveTask,
} from "@pv/tui";
import { getFlag, hasFlag } from "../cliHelpers.js";

type WebhookSetupAnswers = {
  rbUrl?: string;
  rbToken?: string;
  gitlabUrl?: string;
  gitlabKey?: string;
  gitlabWebhookSecret?: string;
  githubWebhookSecret?: string;
  rbWebhookSecret?: string;
  gitlabWebhookEnabled?: boolean;
  githubWebhookEnabled?: boolean;
  reviewboardWebhookEnabled?: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;
  sslCaPath?: string;
  webhookConcurrency?: number;
  webhookQueueLimit?: number;
  webhookJobTimeoutMs?: number;
};

type GitHubSetupAnswers = {
  openaiApiUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  useCustomStreaming?: boolean;
  githubToken?: string;
};

type GitLabSetupAnswers = {
  openaiApiUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  useCustomStreaming?: boolean;
  gitlabUrl?: string;
  gitlabKey?: string;
};

type ReviewBoardSetupAnswers = {
  openaiApiUrl?: string;
  openaiApiKey?: string;
  useCustomStreaming?: boolean;
  rbUrl?: string;
  rbToken?: string;
  svnRepositoryUrl?: string;
  svnUsername?: string;
  svnPassword?: string;
};

type SubversionSetupAnswers = {
  svnRepositoryUrl?: string;
  svnUsername?: string;
  svnPassword?: string;
};

export async function runInitCommand(args: string[] = []): Promise<void> {
  if (hasFlag(args, "help") || hasFlag(args, "h")) {
    printCommandHelp([
      {
        title: "USAGE",
        lines: ["pv init [options]"],
      },
      {
        title: "OPTIONS",
        lines: [
          "--gitlab               Configure GitLab settings",
          "--github               Configure GitHub settings",
          "--reviewboard          Configure Review Board settings",
          "--subversion, --svn    Configure Subversion settings",
          "--webhook              Configure server webhook settings",
          "--sdd                  Install GitHub Copilot SDD prompt files",
          "--rpi                  Install GitHub Copilot RPI prompt files",
          "--path, -p <path>      Target workspace path for template installs",
          "--target <target>      Template target for installs (supported: copilot)",
          "--help, -h             Show this help",
        ],
      },
      {
        title: "EXAMPLES",
        lines: [
          "pv init",
          "pv init --gitlab",
          "pv init --github",
          "pv init --reviewboard",
          "pv init --subversion",
          "pv init --webhook",
          "pv init --sdd --path .",
          "pv init --rpi --path .",
        ],
      },
      {
        title: "SETUP MODES",
        lines: [
          "default     Bootstrap local CR directories, prompts, and bundled assets",
          "gitlab      Save GitLab URL/token and model settings",
          "github      Save GitHub token and model settings",
          "reviewboard Save Review Board and optional SVN settings",
          "subversion  Save standalone SVN repository credentials",
          "webhook     Configure shared GitLab/Review Board webhook settings",
          "sdd         Install GitHub Copilot spec-driven development prompts",
          "rpi         Install GitHub Copilot research-plan-implement prompts",
        ],
      },
    ]);
    return;
  }

  const isSdd = hasFlag(args, "sdd");
  const isWebhook = hasFlag(args, "webhook");
  const isReviewBoard = hasFlag(args, "reviewboard");
  const isRpi = hasFlag(args, "rpi");
  const isGitlab = hasFlag(args, "gitlab");
  const isGithub = hasFlag(args, "github");
  const isSubversion = hasFlag(args, "subversion") || hasFlag(args, "svn");

  if (isSdd) {
    await runSddSetup(args);
    return;
  }

  if (isWebhook) {
    await runWebhookSetup(args);
    return;
  }

  if (isReviewBoard) {
    await runRbSetup(args);
    return;
  }

  if (isRpi) {
    await runRpiSetup(args);
    return;
  }

  if (isGitlab) {
    await runGitLabSetup(args);
    return;
  }

  if (isGithub) {
    await runGitHubSetup(args);
    return;
  }

  if (isSubversion) {
    await runSubversionSetup(args);
    return;
  }

  await bootstrap(args);
}

async function runSetupTask(
  title: string,
  description: string,
  run: (ui: LiveController) => Promise<void>
): Promise<void> {
  try {
    await runLiveTask(title, run, description);
  } catch {
    process.exitCode = 1;
  }
}

async function bootstrap(_args: string[] = []): Promise<void> {
  await runSetupTask(
    "CR Initialization",
    "Bootstrap local CR directories, prompts, and bundled assets.",
    async (ui) => {
      const spinner = createSpinner("Bootstrapping application...").start();
      const repoRoot = repoRootFromModule(import.meta.url);
      await initializeCRHome(repoRoot);
      spinner.stop();
      ui.setResult("Workflow: Initialization", `Configuration path: ${PV_CONF_PATH}`);
    }
  );
}

async function runSddSetup(args: string[] = []): Promise<void> {
  await runSetupTask(
    "Spec-Driven Development Setup",
    "Install GitHub Copilot SDD prompt files into the selected workspace.",
    async (ui) => {
      createSpinner("Loading settings...").start().stop();

      const targetPath = path.resolve(getFlag(args, "path", ".", "-p"));
      const targetRaw = getFlag(args, "target", "copilot");

      if (targetRaw !== "copilot") {
        printError(`Unsupported SDD target: ${targetRaw}. Use copilot.`);
        process.exitCode = 1;
        ui.setResult("Workflow: SDD Setup", "Status: Cancelled.");
        return;
      }

      const target = targetRaw as SpecTarget;

      printInfo(`Setting up SDD commands for ${target} at ${targetPath}...`);

      const copiedFiles = await setupSpecs(targetPath, target);

      if (copiedFiles.length === 0) {
        printInfo("No files were copied.");
      } else {
        printDivider();
        printSuccess(`Successfully setup ${copiedFiles.length} SDD files:`);
        for (const file of copiedFiles) {
          console.log(`  - ${path.relative(targetPath, file)}`);
        }

        const summary = `
### Spec-Driven Development Workflow

These prompt files are installed for **GitHub Copilot**.

1.  Run **/spec.prd** to create \`.features/<feature-name>-<id>/prd.md\`
2.  Run **/spec.design** to create \`design.md\` from requirements + codebase
3.  Run **/spec.threat-model** to create STRIDE threat model as \`threat-model.md\`
4.  Run **/spec.refine** to iterate on \`design.md\` with your context
5.  Run **/spec.plan** to create staged \`plan.md\` with goals and exit criteria
6.  Run **/spec.doit** to execute stages from \`plan.md\` and update \`done.md\`

Use the same feature name or folder across commands so they reference the same \`.features/<feature-name>-<id>/\` directory.
      `;

        printWorkflowOutput({ title: "Spec-Driven Development Workflow", output: summary });
        printDivider();
      }

      ui.setResult("Workflow: SDD Setup", `Target: ${target}\nPath: ${targetPath}`);
    }
  );
}

async function runRpiSetup(args: string[] = []): Promise<void> {
  await runSetupTask(
    "Research Plan Implement Setup",
    "Install GitHub Copilot RPI prompt files into the selected workspace.",
    async (ui) => {
      createSpinner("Loading settings...").start().stop();

      const targetPath = path.resolve(getFlag(args, "path", ".", "-p"));
      const targetRaw = getFlag(args, "target", "copilot");

      if (targetRaw !== "copilot") {
        printError(`Unsupported RPI target: ${targetRaw}. Use copilot.`);
        process.exitCode = 1;
        ui.setResult("Workflow: RPI Setup", "Status: Cancelled.");
        return;
      }

      const target = targetRaw as RpiTarget;

      printInfo(`Setting up RPI prompts for ${target} at ${targetPath}...`);

      const copiedFiles = await setupRpi(targetPath, target);

      if (copiedFiles.length === 0) {
        printInfo("No files were copied.");
      } else {
        printDivider();
        printSuccess(`Successfully setup ${copiedFiles.length} RPI files:`);
        for (const file of copiedFiles) {
          console.log(`  - ${path.relative(targetPath, file)}`);
        }

        const summary = `
### Research Plan Implement Workflow

These prompt files are installed for **GitHub Copilot**.

1.  Run **/rpi.research** to create \`.rpi/<topic-name>-<id>/research.md\`
2.  Run **/rpi.plan** to create \`plan.md\` from research + codebase findings
3.  Run **/rpi.implement** to execute the plan and update \`implementation.md\`

Use the same topic name or folder across commands so they reference the same \`.rpi/<topic-name>-<id>/\` directory.
      `;

        printWorkflowOutput({ title: "Research Plan Implement Workflow", output: summary });
        printDivider();
      }

      ui.setResult("Workflow: RPI Setup", `Target: ${target}\nPath: ${targetPath}`);
    }
  );
}

async function runWebhookSetup(_args: string[] = []): Promise<void> {
  await runSetupTask(
    "Webhook Configuration",
    "Configure webhook endpoints, secrets, and optional SSL settings for CR automation.",
    async (ui) => {
      const existing = await loadPVConfig();

      createSpinner("Loading settings...").start().stop();

      printEmptyLine();
      printInfo(
        "This sets up one shared server for GitLab, GitHub, and Review Board. Use /webhook/gitlab, /webhook/github, and /webhook/reviewboard for provider-specific automation."
      );
      printWarning(
        "Review Board webhook support is summary-only today. Configure only the review_request_published event and use the same HMAC secret in Review Board and CR."
      );

      const prompts: Parameters<typeof promptWithFrame>[0] = [
        {
          type: "text",
          name: "gitlabUrl",
          message: "GitLab URL",
          initial: existing.gitlabUrl ?? defaultConfig.gitlabUrl,
        },
        {
          type: "password",
          name: "gitlabKey",
          message: "GitLab Access Token (api scope)",
          initial: existing.gitlabKey ?? "",
        },
        {
          type: "password",
          name: "gitlabWebhookSecret",
          message: "GitLab Webhook Secret (X-Gitlab-Token)",
          initial: existing.gitlabWebhookSecret ?? "",
        },
        {
          type: "password",
          name: "githubWebhookSecret",
          message: "GitHub Webhook Secret (X-Hub-Signature-256)",
          initial: existing.githubWebhookSecret ?? "",
        },
        {
          type: "text",
          name: "rbUrl",
          message: "Review Board URL",
          initial: existing.rbUrl ?? defaultConfig.rbUrl,
        },
        {
          type: "password",
          name: "rbToken",
          message: "Review Board API Token",
          initial: existing.rbToken ?? "",
        },
        {
          type: "password",
          name: "rbWebhookSecret",
          message: "Review Board Webhook Secret (HMAC signing secret)",
          initial: existing.rbWebhookSecret ?? "",
        },
        {
          type: "toggle",
          name: "gitlabWebhookEnabled",
          message: "Enable GitLab webhook route",
          initial: existing.gitlabWebhookEnabled ?? true,
          active: "on",
          inactive: "off",
        },
        {
          type: "toggle",
          name: "githubWebhookEnabled",
          message: "Enable GitHub webhook route",
          initial: existing.githubWebhookEnabled ?? true,
          active: "on",
          inactive: "off",
        },
        {
          type: "toggle",
          name: "reviewboardWebhookEnabled",
          message: "Enable Review Board webhook route",
          initial: existing.reviewboardWebhookEnabled ?? true,
          active: "on",
          inactive: "off",
        },
      ];

      prompts.push(
        {
          type: "text",
          name: "sslCertPath",
          message: "SSL Certificate Path (for pv serve)",
          initial: existing.sslCertPath ?? "",
        },
        {
          type: "text",
          name: "sslKeyPath",
          message: "SSL Private Key Path (for pv serve)",
          initial: existing.sslKeyPath ?? "",
        },
        {
          type: "text",
          name: "sslCaPath",
          message: "SSL CA Bundle Path (optional)",
          initial: existing.sslCaPath ?? "",
        },
        {
          type: "number",
          name: "webhookConcurrency",
          message: "Max concurrent review jobs",
          initial: existing.webhookConcurrency ?? 3,
        },
        {
          type: "number",
          name: "webhookQueueLimit",
          message: "Max jobs in queue",
          initial: existing.webhookQueueLimit ?? 50,
        },
        {
          type: "number",
          name: "webhookJobTimeoutMs",
          message: "Review job timeout (ms)",
          initial: existing.webhookJobTimeoutMs ?? 600000,
        }
      );

      const answers = (await promptWithFrame(prompts, {
        onCancel: () => true,
      })) as WebhookSetupAnswers;

      if (answers.webhookConcurrency === undefined) {
        printWarning("Webhook initialization cancelled.");
        ui.setResult("Workflow: Webhook Configuration", "Status: Cancelled.");
        return;
      }

      const nextConfig: CRConfig = {
        ...existing,
        openaiApiUrl: existing.openaiApiUrl ?? defaultConfig.openaiApiUrl,
        openaiApiKey: existing.openaiApiKey ?? "",
        openaiModel: existing.openaiModel ?? defaultConfig.openaiModel,
        useCustomStreaming: existing.useCustomStreaming ?? false,
        gitlabUrl: answers.gitlabUrl || existing.gitlabUrl || defaultConfig.gitlabUrl,
        gitlabKey: answers.gitlabKey || existing.gitlabKey || "",
        gitlabWebhookSecret: answers.gitlabWebhookSecret || undefined,
        githubWebhookSecret: answers.githubWebhookSecret || undefined,
        rbUrl: answers.rbUrl || undefined,
        rbToken: answers.rbToken || undefined,
        rbWebhookSecret: answers.rbWebhookSecret || undefined,
        gitlabWebhookEnabled: answers.gitlabWebhookEnabled ?? existing.gitlabWebhookEnabled ?? true,
        githubWebhookEnabled: answers.githubWebhookEnabled ?? existing.githubWebhookEnabled ?? true,
        reviewboardWebhookEnabled:
          answers.reviewboardWebhookEnabled ?? existing.reviewboardWebhookEnabled ?? true,
        sslCertPath: answers.sslCertPath || undefined,
        sslKeyPath: answers.sslKeyPath || undefined,
        sslCaPath: answers.sslCaPath || undefined,
        webhookConcurrency: answers.webhookConcurrency,
        webhookQueueLimit: answers.webhookQueueLimit,
        webhookJobTimeoutMs: answers.webhookJobTimeoutMs,
      };

      await saveCRConfig(nextConfig);

      printDivider();
      printSuccess(`Webhook configuration updated in ${PV_CONF_PATH}`);
      printDivider();
      ui.setResult("Workflow: Webhook Configuration", `Saved to: ${PV_CONF_PATH}`);
    }
  );
}

async function runSubversionSetup(_args: string[] = []): Promise<void> {
  await runSetupTask(
    "Subversion Configuration",
    "Store SVN repository and credential settings for workflows that read from Subversion.",
    async (ui) => {
      const existing = await loadPVConfig();

      createSpinner("Loading settings...").start().stop();

      printEmptyLine();
      printInfo(
        "Store SVN credentials for basic-auth HTTP access. Enter the repository URL that CR should use when fetching repository files from SVN."
      );

      const answers = (await promptWithFrame(
        [
          {
            type: "text",
            name: "svnRepositoryUrl",
            message: "SVN Repository URL",
            initial: existing.svnRepositoryUrl ?? "",
          },
          {
            type: "text",
            name: "svnUsername",
            message: "SVN Username (optional)",
            initial: existing.svnUsername ?? "",
          },
          {
            type: "password",
            name: "svnPassword",
            message: "SVN Password (optional)",
            initial: existing.svnPassword ?? "",
          },
        ],
        { onCancel: () => true }
      )) as SubversionSetupAnswers;

      if (
        answers.svnRepositoryUrl === undefined &&
        answers.svnUsername === undefined &&
        answers.svnPassword === undefined
      ) {
        printWarning("Subversion initialization cancelled.");
        ui.setResult("Workflow: Subversion Configuration", "Status: Cancelled.");
        return;
      }

      const nextConfig: CRConfig = {
        ...existing,
        openaiApiUrl: existing.openaiApiUrl ?? defaultConfig.openaiApiUrl,
        openaiApiKey: existing.openaiApiKey ?? "",
        openaiModel: existing.openaiModel ?? defaultConfig.openaiModel,
        useCustomStreaming: existing.useCustomStreaming ?? false,
        gitlabUrl: existing.gitlabUrl ?? defaultConfig.gitlabUrl,
        gitlabKey: existing.gitlabKey ?? "",
        svnRepositoryUrl: answers.svnRepositoryUrl || undefined,
        svnUsername: answers.svnUsername || undefined,
        svnPassword: answers.svnPassword || undefined,
      };

      await saveCRConfig(nextConfig);

      printDivider();
      printSuccess(`Subversion configuration updated in ${PV_CONF_PATH}`);
      printDivider();
      ui.setResult("Workflow: Subversion Configuration", `Saved to: ${PV_CONF_PATH}`);
    }
  );
}

async function runGitLabSetup(_args: string[] = []): Promise<void> {
  await runSetupTask(
    "GitLab Configuration",
    "Configure the OpenAI and GitLab credentials used for merge request workflows.",
    async (ui) => {
      const existing = await loadPVConfig();

      const answers = (await promptWithFrame(
        [
          {
            type: "text",
            name: "openaiApiUrl",
            message: "OpenAI API URL",
            initial: existing.openaiApiUrl ?? defaultConfig.openaiApiUrl,
          },
          {
            type: "password",
            name: "openaiApiKey",
            message: "OpenAI API Key",
            initial: existing.openaiApiKey ?? "",
          },
          {
            type: "text",
            name: "openaiModel",
            message: "OpenAI Model",
            initial: existing.openaiModel ?? defaultConfig.openaiModel,
          },
          {
            type: "toggle",
            name: "useCustomStreaming",
            message: "Use custom streaming (SSE format)",
            initial: existing.useCustomStreaming ?? false,
            active: "yes",
            inactive: "no",
          },
          {
            type: "text",
            name: "gitlabUrl",
            message: "GitLab URL",
            initial: existing.gitlabUrl ?? defaultConfig.gitlabUrl,
          },
          {
            type: "password",
            name: "gitlabKey",
            message: "GitLab Access Token (api scope)",
            initial: existing.gitlabKey ?? "",
          },
        ],
        { onCancel: () => true }
      )) as GitLabSetupAnswers;

      if (!answers.openaiApiUrl || !answers.openaiModel || !answers.gitlabUrl) {
        printWarning("Initialization cancelled.");
        ui.setResult("Workflow: GitLab Configuration", "Status: Cancelled.");
        return;
      }

      const nextConfig: CRConfig = {
        ...existing,
        openaiApiUrl: answers.openaiApiUrl,
        openaiApiKey: answers.openaiApiKey ?? "",
        openaiModel: answers.openaiModel,
        useCustomStreaming: answers.useCustomStreaming ?? false,
        gitlabUrl: answers.gitlabUrl,
        gitlabKey: answers.gitlabKey ?? "",
      };

      await saveCRConfig(nextConfig);

      printDivider();
      printSuccess(`Configuration saved to ${PV_CONF_PATH}`);
      printDivider();
      ui.setResult("Workflow: GitLab Configuration", `Saved to: ${PV_CONF_PATH}`);
    }
  );
}

async function runGitHubSetup(_args: string[] = []): Promise<void> {
  await runSetupTask(
    "GitHub Configuration",
    "Configure the OpenAI and GitHub credentials used for pull request workflows.",
    async (ui) => {
      const existing = await loadPVConfig();

      const answers = (await promptWithFrame(
        [
          {
            type: "text",
            name: "openaiApiUrl",
            message: "OpenAI API URL",
            initial: existing.openaiApiUrl ?? defaultConfig.openaiApiUrl,
          },
          {
            type: "password",
            name: "openaiApiKey",
            message: "OpenAI API Key",
            initial: existing.openaiApiKey ?? "",
          },
          {
            type: "text",
            name: "openaiModel",
            message: "OpenAI Model",
            initial: existing.openaiModel ?? defaultConfig.openaiModel,
          },
          {
            type: "toggle",
            name: "useCustomStreaming",
            message: "Use custom streaming (SSE format)",
            initial: existing.useCustomStreaming ?? false,
            active: "yes",
            inactive: "no",
          },
          {
            type: "password",
            name: "githubToken",
            message: "GitHub Personal Access Token",
            initial: existing.githubToken ?? "",
          },
        ],
        { onCancel: () => true }
      )) as GitHubSetupAnswers;

      if (!answers.openaiApiUrl || !answers.openaiModel) {
        printWarning("Initialization cancelled.");
        ui.setResult("Workflow: GitHub Configuration", "Status: Cancelled.");
        return;
      }

      const nextConfig: CRConfig = {
        ...existing,
        openaiApiUrl: answers.openaiApiUrl,
        openaiApiKey: answers.openaiApiKey ?? "",
        openaiModel: answers.openaiModel,
        useCustomStreaming: answers.useCustomStreaming ?? false,
        gitlabUrl: existing.gitlabUrl ?? defaultConfig.gitlabUrl,
        gitlabKey: existing.gitlabKey ?? "",
        githubToken: answers.githubToken ?? "",
      };

      await saveCRConfig(nextConfig);

      printDivider();
      printSuccess(`Configuration saved to ${PV_CONF_PATH}`);
      printDivider();
      ui.setResult("Workflow: GitHub Configuration", `Saved to: ${PV_CONF_PATH}`);
    }
  );
}

async function runRbSetup(_args: string[] = []): Promise<void> {
  await runSetupTask(
    "Review Board Configuration",
    "Configure the OpenAI, Review Board, and optional SVN settings used for review request workflows.",
    async (ui) => {
      const existing = await loadPVConfig();

      createSpinner("Loading settings...").start().stop();

      const answers = (await promptWithFrame(
        [
          {
            type: "text",
            name: "openaiApiUrl",
            message: "OpenAI API URL",
            initial: existing.openaiApiUrl ?? defaultConfig.openaiApiUrl,
          },
          {
            type: "password",
            name: "openaiApiKey",
            message: "OpenAI API Key",
            initial: existing.openaiApiKey ?? "",
          },
          {
            type: "toggle",
            name: "useCustomStreaming",
            message: "Use custom streaming (SSE format)",
            initial: existing.useCustomStreaming ?? false,
            active: "yes",
            inactive: "no",
          },
          {
            type: "text",
            name: "rbUrl",
            message: "Review Board URL",
            initial: existing.rbUrl ?? defaultConfig.rbUrl,
          },
          {
            type: "password",
            name: "rbToken",
            message: "Review Board API Token",
            initial: existing.rbToken ?? "",
          },
          {
            type: "text",
            name: "svnRepositoryUrl",
            message: "SVN Repository URL",
            initial: existing.svnRepositoryUrl ?? "",
          },
          {
            type: "text",
            name: "svnUsername",
            message: "SVN Username (optional)",
            initial: existing.svnUsername ?? "",
          },
          {
            type: "password",
            name: "svnPassword",
            message: "SVN Password (optional)",
            initial: existing.svnPassword ?? "",
          },
        ],
        { onCancel: () => true }
      )) as ReviewBoardSetupAnswers;

      if (!answers.rbUrl || !answers.openaiApiUrl) {
        printWarning("Review Board initialization cancelled.");
        ui.setResult("Workflow: Review Board Configuration", "Status: Cancelled.");
        return;
      }

      const nextConfig: CRConfig = {
        ...existing,
        openaiModel: existing.openaiModel ?? defaultConfig.openaiModel,
        useCustomStreaming: answers.useCustomStreaming ?? false,
        gitlabUrl: existing.gitlabUrl ?? defaultConfig.gitlabUrl,
        gitlabKey: existing.gitlabKey ?? "",
        rbUrl: answers.rbUrl,
        rbToken: answers.rbToken ?? "",
        openaiApiUrl: answers.openaiApiUrl,
        openaiApiKey: answers.openaiApiKey ?? "",
        svnRepositoryUrl: answers.svnRepositoryUrl,
        svnUsername: answers.svnUsername,
        svnPassword: answers.svnPassword,
      };

      await saveCRConfig(nextConfig);

      printDivider();
      printSuccess(`Review Board configuration updated in ${PV_CONF_PATH}`);
      printDivider();
      ui.setResult("Workflow: Review Board Configuration", `Saved to: ${PV_CONF_PATH}`);
    }
  );
}
