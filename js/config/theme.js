const THEME_KEYS = [
  "color-primary",
  "color-primary-dark",
  "color-primary-light",
  "color-bg",
  "color-surface",
  "color-text",
  "color-muted",
  "color-border"
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
