import { initializeCRHome } from "../utils/bootstrap.js";
import { loadCRConfig, saveCRConfig } from "../utils/config.js";
import { CR_CONF_PATH, repoRootFromModule } from "../utils/paths.js";
import { createSpinner } from "../utils/spinner.js";
import { printError, printSuccess, printWarning } from "../ui/console.js";
import { promptWithFrame } from "../ui/prompt.js";
import { defaultConfig } from "../types/config.js";

export async function runInitCommand(): Promise<void> {
  const spinner = await createSpinner("Preparing CR directories and bundled resources...");
  spinner.start();

  try {
    const repoRoot = repoRootFromModule(import.meta.url);
    await initializeCRHome(repoRoot);
    spinner.succeed("CR home initialized.");
  } catch (error) {
    spinner.fail("Failed to initialize CR home.");
    const message = error instanceof Error ? error.message : String(error);
    printError(message);
    process.exitCode = 1;
    return;
  }

  const existing = await loadCRConfig();

  const answers = await promptWithFrame(
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
        type: "select",
        name: "terminalTheme",
        message: "Terminal theme (for optimal colors)",
        choices: [
          { title: "Auto-detect", value: "auto" },
          { title: "Dark background", value: "dark" },
          { title: "Light background", value: "light" },
        ],
        initial: existing.terminalTheme === "light" ? 2 : existing.terminalTheme === "dark" ? 1 : 0,
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
  );

  if (!answers.openaiApiUrl || !answers.openaiModel || !answers.gitlabUrl) {
    printWarning("Initialization cancelled.");
    return;
  }

  await saveCRConfig({
    openaiApiUrl: answers.openaiApiUrl,
    openaiApiKey: answers.openaiApiKey ?? "",
    openaiModel: answers.openaiModel,
    useCustomStreaming: answers.useCustomStreaming ?? false,
    terminalTheme: answers.terminalTheme ?? "auto",
    gitlabUrl: answers.gitlabUrl,
    gitlabKey: answers.gitlabKey ?? "",
  });

  printSuccess(`Configuration saved to ${CR_CONF_PATH}`);
}
