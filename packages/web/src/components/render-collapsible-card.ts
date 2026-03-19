import { html, type TemplateResult } from "lit";
import { ChevronDown } from "lucide";
import "./cr-icon.js";

type CollapsibleCardArgs = {
  summary: TemplateResult;
  body: TemplateResult;
  open?: boolean;
  rootClass?: string;
  cardClass?: string;
  summaryClass?: string;
  bodyClass?: string;
};

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function renderCollapsibleCard(args: CollapsibleCardArgs) {
  return html`
    <details
      class=${joinClasses(
        "cr-collapsible-card",
        args.rootClass ?? "card",
        args.cardClass,
      )}
      ?open=${args.open ?? true}
    >
      <summary
        class=${joinClasses(
          "cr-collapsible-card__summary list-none cursor-pointer px-4 py-4",
          args.summaryClass,
        )}
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">${args.summary}</div>
          <span class="cr-collapsible-card__chevron shrink-0 text-base-content/40 transition-transform duration-200 ease-out">
            <cr-icon .icon=${ChevronDown} .size=${16}></cr-icon>
          </span>
        </div>
      </summary>
      <div
        class=${joinClasses(
          "cr-collapsible-card__body px-4 pb-4 pt-0",
          args.bodyClass,
        )}
      >
        ${args.body}
      </div>
    </details>
  `;
}
