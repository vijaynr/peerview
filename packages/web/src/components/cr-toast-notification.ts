import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";

type NoticeTone = "success" | "warning" | "error";

@customElement("cr-toast-notification")
export class CrToastNotification extends LitElement {
  @property() message = "";
  @property() tone: NoticeTone = "success";

  override createRenderRoot() {
    return this;
  }

  render() {
    if (!this.message) return nothing;

    const toneClass =
      this.tone === "error"
        ? "border-destructive/40 bg-[var(--card)] text-destructive-foreground"
        : this.tone === "warning"
          ? "border-[var(--cr-warning)]/40 bg-[var(--card)] text-foreground"
          : "border-[var(--cr-success)]/40 bg-[var(--card)] text-foreground";

    return html`
      <div class="cr-toast flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${toneClass}">
        <span class="flex-1">${this.message}</span>
        ${Button({ variant: "ghost", size: "sm", className: "opacity-70 hover:opacity-100 shrink-0",
          onClick: () => this.dismiss(),
          children: "✕"
        })}
      </div>
    `;
  }

  private dismiss() {
    this.dispatchEvent(
      new CustomEvent("dismiss", { bubbles: true, composed: true })
    );
  }
}
