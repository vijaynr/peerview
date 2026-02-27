/**
 * UI constants for terminal colors, symbols, and formatting.
 * Centralized to avoid duplication across UI modules.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Reads terminal theme from config file synchronously.
 * Returns null if config doesn't exist or theme is not set.
 */
function getConfigTheme(): "dark" | "light" | null {
  try {
    const configPath = path.join(os.homedir(), ".cr.conf");
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const content = fs.readFileSync(configPath, "utf-8");
    const themeMatch = content.match(/terminal_theme\s*=\s*(\w+)/);
    if (themeMatch && themeMatch[1]) {
      const theme = themeMatch[1].toLowerCase();
      if (theme === "dark" || theme === "light") {
        return theme;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Detects if the terminal has a dark background.
 * Uses environment variables and terminal-specific heuristics.
 *
 * Manual override options (in order of precedence):
 * 1. CR_TERMINAL_THEME env var: "dark" or "light"
 * 2. Config file: terminal_theme = "dark" or "light" in ~/.cr.conf
 * 3. Auto-detection via terminal environment variables
 */
function isDarkBackground(): boolean {
  // 1. Check CR_TERMINAL_THEME environment variable override
  const themeOverride = process.env.CR_TERMINAL_THEME;
  if (themeOverride === "light") {
    return false;
  }
  if (themeOverride === "dark") {
    return true;
  }

  // 2. Check config file
  const configTheme = getConfigTheme();
  if (configTheme === "light") {
    return false;
  }
  if (configTheme === "dark") {
    return true;
  }

  // 3. Check Windows Terminal theme (Windows Terminal sets this)
  const wtProfile = process.env.WT_PROFILE_ID;
  if (wtProfile && process.env.WSLENV) {
    // Windows Terminal with WSL - check for light indicators
    const sessionName = process.env.WT_SESSION;
    if (sessionName?.toLowerCase().includes("light")) {
      return false;
    }
  }

  // 4. Check COLORFGBG environment variable (common in Unix terminals)
  // Format: "foreground;background" where higher numbers = lighter
  const colorFgBg = process.env.COLORFGBG;
  if (colorFgBg) {
    const parts = colorFgBg.split(";");
    if (parts.length >= 2) {
      const bg = parseInt(parts[1], 10);
      // Background colors 0-6 are typically dark, 7-15 are light
      if (!isNaN(bg)) {
        return bg < 7;
      }
    }
  }

  // 5. Check explicit theme environment variables
  if (process.env.TERM_BACKGROUND === "light") {
    return false;
  }
  if (process.env.TERM_BACKGROUND === "dark") {
    return true;
  }

  // 6. Check VS Code terminal theme
  const vscodeTheme = process.env.VSCODE_TERMINAL_THEME;
  if (vscodeTheme) {
    return vscodeTheme.toLowerCase().includes("dark");
  }

  // 7. Check iTerm2 profile
  const itermProfile = process.env.ITERM_PROFILE;
  if (itermProfile) {
    const lowerProfile = itermProfile.toLowerCase();
    if (lowerProfile.includes("light")) {
      return false;
    }
    if (lowerProfile.includes("dark")) {
      return true;
    }
  }

  // Default to dark (safest default - bright colors on dark are more readable than dark on light)
  return true;
}

/**
 * Color palette optimized for dark backgrounds.
 */
const DARK_COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[96m", // Bright cyan for better visibility
  green: "\x1b[92m", // Bright green
  yellow: "\x1b[93m", // Bright yellow
  red: "\x1b[91m", // Bright red
  blue: "\x1b[94m", // Bright blue
  orange: "\x1b[38;5;208m", // Bright orange (256-color)
  bold: "\x1b[1m",
  dim: "\x1b[2m",
} as const;

/**
 * Color palette optimized for light backgrounds.
 * Uses darker colors with bold for better contrast.
 */
const LIGHT_COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[1;36m", // Bold cyan for better visibility
  green: "\x1b[1;32m", // Bold green
  yellow: "\x1b[1;33m", // Bold yellow
  red: "\x1b[1;31m", // Bold red
  blue: "\x1b[1;34m", // Bold blue
  orange: "\x1b[1;38;5;202m", // Bold dark orange (256-color)
  bold: "\x1b[1m",
  dim: "\x1b[2m",
} as const;

/**
 * ANSI color and formatting codes for terminal output.
 * Automatically adapts to terminal background (dark/light theme).
 */
export const COLORS = isDarkBackground() ? DARK_COLORS : LIGHT_COLORS;

/**
 * Banner color that adapts to theme.
 * Cyan on dark backgrounds, orange on light backgrounds.
 */
export const BANNER_COLOR = isDarkBackground() ? DARK_COLORS.cyan : LIGHT_COLORS.orange;

/**
 * Unicode bullet point symbol for terminal output.
 */
export const DOT = "●";

/**
 * Border characters for terminal UI elements.
 */
export const BORDERS = {
  horizontal: "─",
} as const;
