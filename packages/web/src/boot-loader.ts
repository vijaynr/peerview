// Boot loader — minimal first-paint spinner shown before the app hydrates.
// Pure inline HTML/CSS/JS so it paints on first frame (no module deps).

export function getBootLoaderStyles(): string {
  return `
/* ── Boot Loader ──────────────────────────────────── */
#cr-boot-loader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  opacity: 1;
  transition: opacity 0.28s ease-out, filter 0.28s ease-out;
}

#cr-boot-loader.boot-exit {
  opacity: 0;
  filter: blur(2px);
  pointer-events: none;
}

/* ── Theme surfaces ───────────────────────────────── */
[data-theme="cr-black"] #cr-boot-loader {
  background:
    radial-gradient(circle at center, rgba(56, 189, 248, 0.06), transparent 42%),
    #0b0e17;
}
[data-theme="cr-light"] #cr-boot-loader {
  background:
    radial-gradient(circle at center, rgba(37, 99, 235, 0.06), transparent 42%),
    #f4f7fb;
}

/* ── Soft texture ─────────────────────────────────── */
#cr-boot-loader::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.03), transparent 50%),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.015),
      rgba(255, 255, 255, 0)
    );
  pointer-events: none;
}

.boot-spinner {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 3px solid transparent;
  animation: boot-spin 0.7s linear infinite;
}

[data-theme="cr-black"] .boot-spinner {
  border-top-color: #7dd3fc;
  border-right-color: rgba(125, 211, 252, 0.3);
  border-bottom-color: rgba(125, 211, 252, 0.14);
  box-shadow: 0 0 24px rgba(56, 189, 248, 0.18);
}

[data-theme="cr-light"] .boot-spinner {
  border-top-color: #2563eb;
  border-right-color: rgba(37, 99, 235, 0.28);
  border-bottom-color: rgba(37, 99, 235, 0.14);
  box-shadow: 0 0 24px rgba(37, 99, 235, 0.14);
}

@keyframes boot-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Respect reduced motion while keeping the loader visible. */
@media (prefers-reduced-motion: reduce) {
  .boot-spinner {
    animation-duration: 1.4s;
  }
  #cr-boot-loader {
    transition-duration: 0.01ms;
  }
}
`;
}

export function getBootLoaderHtml(): string {
  return `
<div id="cr-boot-loader" aria-label="Loading application" role="status">
  <div class="boot-spinner" aria-hidden="true"></div>
</div>`;
}

export function getBootLoaderScript(): string {
  return `<script>
(() => {
  const MIN_DISPLAY_MS = 250;
  const bootStart = Date.now();
  const loaderEl = document.getElementById("cr-boot-loader");
  if (!loaderEl) return;

  window.__crBootDismiss = () => {
    const elapsed = Date.now() - bootStart;
    const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);
    setTimeout(() => {
      loaderEl.classList.add("boot-exit");
      loaderEl.addEventListener("transitionend", () => loaderEl.remove(), { once: true });
      setTimeout(() => loaderEl.remove(), 400);
    }, wait);
  };
})();
</script>`;
}
