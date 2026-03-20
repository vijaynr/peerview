import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

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

    const alertClass =
      this.tone === "success"
        ? "alert-success"
        : this.tone === "error"
          ? "alert-error"
          : "alert-warning";

    return html`
      <div class="cr-toast alert ${alertClass} text-sm shadow-lg">
        <span class="flex-1">${this.message}</span>
        <button
          class="btn btn-ghost btn-xs opacity-70 hover:opacity-100"
          type="button"
          @click=${this.dismiss}
        >✕</button>
      </div>
    `;
  }

  private dismiss() {
    this.dispatchEvent(
      new CustomEvent("dismiss", { bubbles: true, composed: true })
    );
  }
}
