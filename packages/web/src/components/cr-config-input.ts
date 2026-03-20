import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("cr-config-input")
export class CrConfigInput extends LitElement {
  @property() label = "";
  @property() note = "";
  @property() value = "";
  @property() type = "text";
  @property({ attribute: "input-mode" }) inputMode: string = "text";

  override createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="form-control gap-1">
        <label class="label py-0">
          <span class="label-text text-sm font-medium">${this.label}</span>
        </label>
        <div class="text-xs text-base-content/50 mb-1">${this.note}</div>
        <input
          class="input input-bordered input-sm font-mono w-full"
          type=${this.type}
          .value=${this.value}
          inputmode=${this.inputMode}
          @input=${this.handleInput}
        />
      </div>
    `;
  }

  private handleInput(e: Event) {
    this.dispatchEvent(
      new CustomEvent("value-change", {
        detail: (e.target as HTMLInputElement).value,
        bubbles: true,
        composed: true,
      })
    );
  }
}
