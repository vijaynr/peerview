import chatPrompt from "../../../../resources/prompts/chat.txt" with { type: "text" };
import mrPrompt from "../../../../resources/prompts/mr.txt" with { type: "text" };
import reviewPrompt from "../../../../resources/prompts/review.txt" with { type: "text" };
import cleanCodeReviewAgentPrompt from "../../../../resources/prompts/review-agents/clean-code.txt" with {
  type: "text",
};
import generalReviewAgentPrompt from "../../../../resources/prompts/review-agents/general.txt" with {
  type: "text",
};
import performanceReviewAgentPrompt from "../../../../resources/prompts/review-agents/performance.txt" with {
  type: "text",
};
import securityReviewAgentPrompt from "../../../../resources/prompts/review-agents/security.txt" with {
  type: "text",
};
import testQualityReviewAgentPrompt from "../../../../resources/prompts/review-agents/test-quality.txt" with {
  type: "text",
};
import reviewAggregatePrompt from "../../../../resources/prompts/review-aggregate.txt" with {
  type: "text",
};
import summarizePrompt from "../../../../resources/prompts/summarize.txt" with { type: "text" };

// Unified Spec Templates
import specDesign from "../../../../resources/specs/templates/design.md" with { type: "text" };
import specDoit from "../../../../resources/specs/templates/doit.md" with { type: "text" };
import specPlan from "../../../../resources/specs/templates/plan.md" with { type: "text" };
import specPrd from "../../../../resources/specs/templates/prd.md" with { type: "text" };
import specRefine from "../../../../resources/specs/templates/refine.md" with { type: "text" };
import specThreat from "../../../../resources/specs/templates/threat-model.md" with {
  type: "text",
};

export const bundledPrompts = {
  "chat.txt": chatPrompt,
  "mr.txt": mrPrompt,
  "review.txt": reviewPrompt,
  "review-aggregate.txt": reviewAggregatePrompt,
  "review-agents/clean-code.txt": cleanCodeReviewAgentPrompt,
  "review-agents/general.txt": generalReviewAgentPrompt,
  "review-agents/performance.txt": performanceReviewAgentPrompt,
  "review-agents/security.txt": securityReviewAgentPrompt,
  "review-agents/test-quality.txt": testQualityReviewAgentPrompt,
  "summarize.txt": summarizePrompt,
} as const;

export const bundledSpecTemplates = {
  "prd.md": specPrd,
  "design.md": specDesign,
  "threat-model.md": specThreat,
  "refine.md": specRefine,
  "plan.md": specPlan,
  "doit.md": specDoit,
} as const;
