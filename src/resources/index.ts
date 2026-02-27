import bannerText from "../../resources/assets/banner.txt" with { type: "text" };
import chatPrompt from "../../resources/prompts/chat.txt" with { type: "text" };
import mrPrompt from "../../resources/prompts/mr.txt" with { type: "text" };
import reviewPrompt from "../../resources/prompts/review.txt" with { type: "text" };
import summarizePrompt from "../../resources/prompts/summarize.txt" with { type: "text" };

export const bundledAssets = {
  "banner.txt": bannerText,
} as const;

export const bundledPrompts = {
  "chat.txt": chatPrompt,
  "mr.txt": mrPrompt,
  "review.txt": reviewPrompt,
  "summarize.txt": summarizePrompt,
} as const;
