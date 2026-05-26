const THEME_STORAGE_KEY = "marivini-theme";

const THEME_KEYS = [
  "color-primary",
  "color-primary-dark",
  "color-primary-light",
  "color-on-primary",
  "color-bg",
  "color-surface",
  "color-surface-soft",
  "color-text",
  "color-muted",
  "color-border"
];

export const THEME_PRESETS = [
  {
    id: "teal",
    label: "Verde",
    swatch: "#0f9f8f",
    variables: {
      "color-primary": "#0f9f8f",
      "color-primary-dark": "#087f73",
      "color-primary-light": "#e6f7f5",
      "color-on-primary": "#ffffff"
    }
  },
  {
    id: "rose",
    label: "Rosa",
    swatch: "#e86a92",
    variables: {
      "color-primary": "#e86a92",
      "color-primary-dark": "#c75179",
      "color-primary-light": "#fdebf2",
      "color-on-primary": "#ffffff"
    }
  },
  {
    id: "yellow",
    label: "Amarelo",
    swatch: "#d4a106",
    variables: {
      "color-primary": "#d4a106",
      "color-primary-dark": "#ad8400",
      "color-primary-light": "#fff7d6",
      "color-on-primary": "#2f2412"
    }
  },
  {
    id: "blue",
    label: "Azul",
    swatch: "#3b82f6",
    variables: {
      "color-primary": "#3b82f6",
      "color-primary-dark": "#1d4ed8",
      "color-primary-light": "#e8f0ff",
      "color-on-primary": "#ffffff"
    }
  },
  {
    id: "purple",
    label: "Roxo",
    swatch: "#8b5cf6",
    variables: {
      "color-primary": "#8b5cf6",
      "color-primary-dark": "#6d28d9",
      "color-primary-light": "#f1ebff",
      "color-on-primary": "#ffffff"
    }
  },
  {
    id: "orange",
    label: "Laranja",
    swatch: "#f97316",
    variables: {
      "color-primary": "#f97316",
      "color-primary-dark": "#c2410c",
      "color-primary-light": "#fff0e5",
      "color-on-primary": "#ffffff"
    }
  }
];

export function getThemeVariables() {
  const styles = getComputedStyle(document.documentElement);
  return THEME_KEYS.reduce((accumulator, key) => {
    accumulator[key] = styles.getPropertyValue(`--${key}`).trim();
    return accumulator;
  }, {});
}

export function applyTheme(overrides = {}) {
  Object.entries(overrides).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--${key}`, value);
  });
}

export function saveThemePreset(presetId) {
  window.localStorage.setItem(THEME_STORAGE_KEY, presetId);
}

export function getSavedThemePreset() {
  return window.localStorage.getItem(THEME_STORAGE_KEY) || "teal";
}

export function applyThemePreset(presetId) {
  const preset = THEME_PRESETS.find((item) => item.id === presetId) || THEME_PRESETS[0];
  applyTheme(preset.variables);
  saveThemePreset(preset.id);
  return preset;
}

export function initializeTheme() {
  return applyThemePreset(getSavedThemePreset());
}
