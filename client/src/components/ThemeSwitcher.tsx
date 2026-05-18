import type { ThemeMode } from "../theme";
import { useUiStore } from "../store";

const OPTIONS: { mode: ThemeMode; label: string; title: string }[] = [
  { mode: "light", label: "Light", title: "Light theme" },
  { mode: "dark", label: "Dark", title: "Dark theme" },
  { mode: "system", label: "System", title: "Match system preference" },
];

export function ThemeSwitcher() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex items-center rounded-lg border border-app-border bg-app-surface-muted p-0.5"
    >
      {OPTIONS.map(({ mode, label, title }) => {
        const active = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            title={title}
            aria-pressed={active}
            onClick={() => setTheme(mode)}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              active
                ? "bg-app-surface text-app-text shadow-sm font-medium"
                : "text-app-text-muted hover:text-app-text"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
