export type CRConfig = {
  openaiApiUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  useCustomStreaming: boolean; // Use custom SSE streaming instead of standard OpenAI SDK
  gitlabUrl: string;
  gitlabKey: string;
  terminalTheme?: "auto" | "dark" | "light"; // Optional theme override
};

export const defaultConfig: Pick<CRConfig, "openaiApiUrl" | "openaiModel" | "gitlabUrl"> = {
  openaiApiUrl: "https://model-broker.aviator-model.bp.anthos.otxlab.net/v1",
  openaiModel: "llama-3.3-70b",
  gitlabUrl: "https://gitlab.otxlab.net",
};
