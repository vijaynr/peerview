import DOMPurify from "dompurify";
import { Marked } from "marked";
import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

const markdownParser = new Marked({
  async: false,
  breaks: true,
  gfm: true,
});

type MarkdownRenderOptions = {
  className?: string;
  compact?: boolean;
  emptyText?: string;
};

function joinClasses(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

function renderMarkdownToHtml(content: string) {
  const parsed = markdownParser.parse(content) as string;
  return DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true },
  });
}

export function renderMarkdown(
  content: string | null | undefined,
  options: MarkdownRenderOptions = {},
) {
  const trimmed = content?.trim() ?? "";

  if (!trimmed) {
    return options.emptyText
      ? html`<p class="text-sm text-base-content/50">${options.emptyText}</p>`
      : nothing;
  }

  return html`
    <div
      class=${joinClasses(
        "cr-markdown",
        options.compact && "cr-markdown--compact",
        options.className,
      )}
    >
      ${unsafeHTML(renderMarkdownToHtml(trimmed))}
    </div>
  `;
}
