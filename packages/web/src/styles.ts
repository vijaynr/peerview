import { css } from "lit";

export const dashboardThemeStyles = css`
  :host {
    --bg: #f4ede2;
    --bg-strong: #ede4d6;
    --panel: rgba(255, 251, 245, 0.92);
    --panel-solid: #fffdf8;
    --panel-muted: #f1ebe1;
    --surface: #ffffff;
    --surface-muted: #f5f1e8;
    --line: #d7cdbf;
    --line-strong: #c7bbab;
    --ink: #201a16;
    --ink-soft: #5b554c;
    --ink-faint: #8b8276;
    --accent: #d97612;
    --accent-strong: #b86009;
    --accent-soft: rgba(217, 118, 18, 0.12);
    --success: #2c6a53;
    --success-soft: rgba(44, 106, 83, 0.12);
    --danger: #9a4132;
    --danger-soft: rgba(154, 65, 50, 0.11);
    --shadow: 0 20px 45px rgba(62, 46, 29, 0.08);
    color: var(--ink);
    font-family:
      "IBM Plex Sans",
      "Avenir Next",
      "Segoe UI",
      sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  h1,
  h2,
  h3,
  h4,
  p {
    margin: 0;
  }

  h1,
  h2,
  h3 {
    font-family:
      "IBM Plex Serif",
      "Iowan Old Style",
      "Palatino Linotype",
      serif;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  code,
  pre,
  .mono {
    font-family:
      "IBM Plex Mono",
      "SFMono-Regular",
      "SF Mono",
      "Menlo",
      monospace;
  }

  .muted {
    color: var(--ink-soft);
  }

  .subtle {
    color: var(--ink-faint);
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--ink-soft);
    font-size: 0.77rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .eyebrow::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--accent);
    box-shadow: 0 0 0 5px var(--accent-soft);
  }

  .panel,
  .surface {
    background: var(--panel);
    border: 1px solid var(--line);
    box-shadow: var(--shadow);
    backdrop-filter: blur(10px);
  }

  .surface {
    background: var(--surface);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-muted);
    color: var(--ink-soft);
    font-size: 0.82rem;
    font-weight: 600;
  }

  .badge[data-tone="accent"] {
    border-color: rgba(217, 118, 18, 0.22);
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .badge[data-tone="success"] {
    border-color: rgba(44, 106, 83, 0.22);
    background: var(--success-soft);
    color: var(--success);
  }

  .badge[data-tone="danger"] {
    border-color: rgba(154, 65, 50, 0.22);
    background: var(--danger-soft);
    color: var(--danger);
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background 140ms ease,
      transform 140ms ease;
  }

  .button:hover {
    background: #fff7eb;
    border-color: var(--line-strong);
  }

  .button:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .button[data-tone="primary"] {
    border-color: var(--accent-strong);
    background: var(--accent);
    color: white;
  }

  .button[data-tone="primary"]:hover {
    background: var(--accent-strong);
  }

  .button[data-tone="ghost"] {
    background: transparent;
  }

  .button[data-tone="danger"] {
    border-color: rgba(154, 65, 50, 0.2);
    background: var(--danger-soft);
    color: var(--danger);
  }

  .field,
  .textarea,
  .select {
    width: 100%;
    min-height: 42px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.9);
    color: var(--ink);
  }

  .textarea {
    min-height: 110px;
    resize: vertical;
  }

  .notice {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.72);
    color: var(--ink-soft);
  }

  .notice[data-tone="warning"] {
    border-color: rgba(217, 118, 18, 0.22);
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .notice[data-tone="error"] {
    border-color: rgba(154, 65, 50, 0.2);
    background: var(--danger-soft);
    color: var(--danger);
  }

  .notice[data-tone="success"] {
    border-color: rgba(44, 106, 83, 0.2);
    background: var(--success-soft);
    color: var(--success);
  }
`;
