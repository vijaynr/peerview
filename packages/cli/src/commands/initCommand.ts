import path from "node:path";
import {
  CR_CONF_PATH,
  type CRConfig,
  defaultConfig,
  initializeCRHome,
  loadCRConfig,
  repoRootFromModule,
  type SpecTarget,
  saveCRConfig,
  setupSpecs,
} from "@cr/core";
import {
  COLORS,
  createSpinner,
  DOT,
  printDivider,
  printEmptyLine,
  printError,
  printInfo,
  printSuccess,
  printWarning,
  printWorkflowOutput,
  promptWithFrame,
} from "@cr/ui";
import { getFlag, hasFlag } from "../cliHelpers.js";

type WebhookSetupAnswers = {
  rbUrl?: string;
  rbToken?: string;
  gitlabUrl?: string;
  gitlabKey?: string;
  gitlabWebhookSecret?: string;
  rbWebhookSecret?: string;
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
  const isSdd = hasFlag(args, "sdd");
  const isWebhook = hasFlag(args, "webhook");
  const isRb = hasFlag(args, "rb");
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

  if (isRb) {
    await runRbSetup(args);
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

async function bootstrap(_args: string[] = []): Promise<void> {
  const spinner = createSpinner("Bootstrapping application...").start();
  try {
    const repoRoot = repoRootFromModule(import.meta.url);
    await initializeCRHome(repoRoot);
    spinner.stopAndPersist({
      symbol: COLORS.green + DOT + COLORS.reset,
      text: "Application ready.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail(message);
    process.exitCode = 1;
    return;
  }
}

async function runSddSetup(args: string[] = []): Promise<void> {
  createSpinner("Loading settings...")
    .start()
    .stopAndPersist({
      symbol: COLORS.cyan + DOT + COLORS.reset,
      text: "Initialize Spec-Driven Development templates",
    });

  const targetPath = path.resolve(getFlag(args, "path", ".", "-p"));
  let targetRaw = getFlag(args, "target", "");

  if (!targetRaw) {
    const answer = await promptWithFrame([
      {
        type: "select",
        name: "target",
        message: "Which command templates do you want to install?",
        choices: [
          { title: "All (Copilot & OpenCode)", value: "all" },
          { title: "GH Copilot", value: "copilot" },
          { title: "OpenCode", value: "opencode" },
        ],
        initial: 0,
      },
    ]);

    if (!answer.target) {
      printWarning("SDD setup cancelled.");
      return;
    }
    targetRaw = answer.target;
  }

  if (!["all", "copilot", "opencode"].includes(targetRaw)) {
    printError(`Unsupported SDD target: ${targetRaw}. Use all, copilot, or opencode.`);
    process.exitCode = 1;
    return;
  }

  const target = targetRaw as SpecTarget;

  printInfo(`Setting up SDD commands for ${target} at ${targetPath}...`);

  try {
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

These slash commands are installed for **GitHub Copilot** and **OpenCode**, and are available to run inside those tools.

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
  } catch (err) {
    printError(`Failed to setup SDD: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

async function runWebhookSetup(_args: string[] = []): Promise<void> {
  const existing = await loadCRConfig();

  createSpinner("Loading settings...")
    .start()
    .stopAndPersist({
      symbol: COLORS.cyan + DOT + COLORS.reset,
      text: "Initialize Webhook and SSL configuration",
    });

  printEmptyLine();
  printInfo(
    "This sets up one webhook server for both providers. Use /gitlab for GitLab and /reviewboard for Review Board."
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
  ];

  prompts.push(
    {
      type: "text",
      name: "sslCertPath",
      message: "SSL Certificate Path (for cr serve)",
      initial: existing.sslCertPath ?? "",
    },
    {
      type: "text",
      name: "sslKeyPath",
      message: "SSL Private Key Path (for cr serve)",
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
    rbUrl: answers.rbUrl || undefined,
    rbToken: answers.rbToken || undefined,
    rbWebhookSecret: answers.rbWebhookSecret || undefined,
    sslCertPath: answers.sslCertPath || undefined,
    sslKeyPath: answers.sslKeyPath || undefined,
    sslCaPath: answers.sslCaPath || undefined,
    webhookConcurrency: answers.webhookConcurrency,
    webhookQueueLimit: answers.webhookQueueLimit,
    webhookJobTimeoutMs: answers.webhookJobTimeoutMs,
  };

  await saveCRConfig(nextConfig);

  printDivider();
  printSuccess(`Webhook configuration updated in ${CR_CONF_PATH}`);
  printDivider();
}

async function runSubversionSetup(_args: string[] = []): Promise<void> {
  const existing = await loadCRConfig();

  createSpinner("Loading settings...")
    .start()
    .stopAndPersist({
      symbol: COLORS.cyan + DOT + COLORS.reset,
      text: "Initialize Subversion configuration",
    });

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
  printSuccess(`Subversion configuration updated in ${CR_CONF_PATH}`);
  printDivider();
}

async function runGitLabSetup(_args: string[] = []): Promise<void> {
  const existing = await loadCRConfig();

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
  printSuccess(`Configuration saved to ${CR_CONF_PATH}`);
  printDivider();
}

async function runGitHubSetup(_args: string[] = []): Promise<void> {
  const existing = await loadCRConfig();

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
  printSuccess(`Configuration saved to ${CR_CONF_PATH}`);
  printDivider();
}

async function runRbSetup(_args: string[] = []): Promise<void> {
  const existing = await loadCRConfig();

  createSpinner("Loading settings...")
    .start()
    .stopAndPersist({
      symbol: COLORS.cyan + DOT + COLORS.reset,
      text: "Initialize Review Board configuration",
    });

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
  printSuccess(`Review Board configuration updated in ${CR_CONF_PATH}`);
  printDivider();
}
