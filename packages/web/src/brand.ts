export const WEB_APP_ICON_ROUTE = "/web/icon.svg";
export const WEB_APP_FAVICON_ROUTE = "/favicon.svg";

function getBrandGlyphMarkup(fillId: string, accentId: string): string {
  return `
    <rect x="13" y="11" width="12" height="8" rx="4" fill="url(#${accentId})" />
    <rect x="39" y="11" width="12" height="8" rx="4" fill="url(#${accentId})" />
    <rect x="10" y="22" width="8" height="17" rx="4" fill="url(#${fillId})" />
    <rect x="19" y="22" width="10" height="17" rx="4" fill="url(#${fillId})" />
    <path d="M29 22H35L39 39H25L29 22Z" fill="url(#${fillId})" />
    <rect x="35" y="22" width="10" height="17" rx="4" fill="url(#${fillId})" />
    <rect x="46" y="22" width="8" height="17" rx="4" fill="url(#${fillId})" />
    <rect x="16" y="45" width="8" height="6" rx="3" fill="url(#${fillId})" />
    <rect x="28" y="45" width="8" height="6" rx="3" fill="url(#${fillId})" />
    <rect x="40" y="45" width="8" height="6" rx="3" fill="url(#${fillId})" />
  `;
}

function getBrandBadgeSvg(options: {
  accentColors: [string, string];
  backgroundColors: [string, string];
  glowColor: string;
  idPrefix: string;
  title: string;
}): string {
  const { accentColors, backgroundColors, glowColor, idPrefix, title } = options;
  const bgId = `${idPrefix}-bg`;
  const glowId = `${idPrefix}-glow`;
  const fillId = `${idPrefix}-fill`;
  const accentId = `${idPrefix}-accent`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="${idPrefix}-title">
  <title id="${idPrefix}-title">${title}</title>
  <defs>
    <linearGradient id="${bgId}" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${backgroundColors[0]}" />
      <stop offset="1" stop-color="${backgroundColors[1]}" />
    </linearGradient>
    <radialGradient id="${glowId}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 16) rotate(90) scale(24 28)">
      <stop offset="0" stop-color="${glowColor}" stop-opacity="0.65" />
      <stop offset="1" stop-color="${glowColor}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="${fillId}" x1="12" y1="11" x2="51" y2="52" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${accentColors[0]}" />
      <stop offset="1" stop-color="${accentColors[1]}" />
    </linearGradient>
    <linearGradient id="${accentId}" x1="18" y1="9" x2="46" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f8fbff" />
      <stop offset="1" stop-color="${accentColors[0]}" />
    </linearGradient>
  </defs>
  <rect x="1.5" y="1.5" width="61" height="61" rx="18" fill="url(#${bgId})" />
  <rect x="1.5" y="1.5" width="61" height="61" rx="18" fill="none" stroke="#ffffff1c" stroke-width="1.5" />
  <circle cx="32" cy="19" r="21" fill="url(#${glowId})" />
  ${getBrandGlyphMarkup(fillId, accentId)}
</svg>`.trim();
}

export function getCrAppIconSvg(): string {
  return getBrandBadgeSvg({
    accentColors: ["#8be9ff", "#2563eb"],
    backgroundColors: ["#0f172a", "#050816"],
    glowColor: "#38bdf8",
    idPrefix: "cr-app-icon",
    title: "CR app icon",
  });
}

export function getCrFaviconSvg(): string {
  return getBrandBadgeSvg({
    accentColors: ["#d7f5ff", "#3b82f6"],
    backgroundColors: ["#111827", "#020617"],
    glowColor: "#7dd3fc",
    idPrefix: "cr-favicon",
    title: "CR favicon",
  });
}
