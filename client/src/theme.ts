export type ThemeMode = "light" | "dark" | "system";

export function resolveTheme(mode: ThemeMode | undefined): "light" | "dark" {
  const preference = mode ?? "system";
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}

export function applyTheme(mode: ThemeMode | undefined): void {
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = resolved;
}

/** Read theme from persisted zustand storage before React hydrates. */
export function readPersistedTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem("jira-insights-ui");
    if (!raw) return "system";
    const parsed = JSON.parse(raw) as { state?: { theme?: ThemeMode } };
    const theme = parsed.state?.theme;
    if (theme === "light" || theme === "dark" || theme === "system") return theme;
  } catch {
    /* ignore */
  }
  return "system";
}
