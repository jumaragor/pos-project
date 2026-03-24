export type ThemePresetKey =
  | "DEFAULT_NAVY"
  | "MODERN_BLUE"
  | "FOREST_GREEN"
  | "ELEGANT_PURPLE"
  | "WARM_ORANGE"
  | "CUSTOM";

export type ThemeValues = {
  themePreset: ThemePresetKey;
  themePrimaryColor: string;
  themeAccentColor: string;
  themeSidebarActiveColor: string;
  themeDangerColor: string;
};

type PresetDefinition = Omit<ThemeValues, "themePreset">;

export const themePresets: Record<Exclude<ThemePresetKey, "CUSTOM">, PresetDefinition> = {
  DEFAULT_NAVY: {
    themePrimaryColor: "#0F172A",
    themeAccentColor: "#2563EB",
    themeSidebarActiveColor: "#1E3A8A",
    themeDangerColor: "#DC2626"
  },
  MODERN_BLUE: {
    themePrimaryColor: "#1D4ED8",
    themeAccentColor: "#0EA5E9",
    themeSidebarActiveColor: "#1E40AF",
    themeDangerColor: "#DC2626"
  },
  FOREST_GREEN: {
    themePrimaryColor: "#166534",
    themeAccentColor: "#0D9488",
    themeSidebarActiveColor: "#14532D",
    themeDangerColor: "#B91C1C"
  },
  ELEGANT_PURPLE: {
    themePrimaryColor: "#6D28D9",
    themeAccentColor: "#7C3AED",
    themeSidebarActiveColor: "#5B21B6",
    themeDangerColor: "#BE123C"
  },
  WARM_ORANGE: {
    themePrimaryColor: "#C2410C",
    themeAccentColor: "#EA580C",
    themeSidebarActiveColor: "#9A3412",
    themeDangerColor: "#B91C1C"
  }
};

export const defaultThemeValues: ThemeValues = {
  themePreset: "DEFAULT_NAVY",
  ...themePresets.DEFAULT_NAVY
};

export function isValidHexColor(value: string) {
  return /^#([0-9a-fA-F]{6})$/.test(value.trim());
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b) };
}

function toSoftColor(hexColor: string, alpha = 0.14) {
  const { r, g, b } = hexToRgb(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function normalizeHexColor(value: string, fallback: string) {
  const normalized = value.trim().toUpperCase();
  return isValidHexColor(normalized) ? normalized : fallback;
}

export function resolveThemeValues(input: Partial<ThemeValues>) {
  const fallback = themePresets.DEFAULT_NAVY;
  return {
    themePreset: (input.themePreset as ThemePresetKey) ?? "DEFAULT_NAVY",
    themePrimaryColor: normalizeHexColor(input.themePrimaryColor ?? fallback.themePrimaryColor, fallback.themePrimaryColor),
    themeAccentColor: normalizeHexColor(input.themeAccentColor ?? fallback.themeAccentColor, fallback.themeAccentColor),
    themeSidebarActiveColor: normalizeHexColor(input.themeSidebarActiveColor ?? fallback.themeSidebarActiveColor, fallback.themeSidebarActiveColor),
    themeDangerColor: normalizeHexColor(input.themeDangerColor ?? fallback.themeDangerColor, fallback.themeDangerColor)
  };
}

export function applyThemeToDocument(input: Partial<ThemeValues>) {
  if (typeof document === "undefined") return;
  const theme = resolveThemeValues(input);
  const root = document.documentElement;
  root.style.setProperty("--color-primary", theme.themePrimaryColor);
  root.style.setProperty("--color-accent", theme.themeAccentColor);
  root.style.setProperty("--color-sidebar-active", theme.themeSidebarActiveColor);
  root.style.setProperty("--color-danger", theme.themeDangerColor);
  root.style.setProperty("--color-primary-soft", toSoftColor(theme.themePrimaryColor));
  root.style.setProperty("--color-accent-soft", toSoftColor(theme.themeAccentColor));
  root.style.setProperty("--color-danger-soft", toSoftColor(theme.themeDangerColor));
}
