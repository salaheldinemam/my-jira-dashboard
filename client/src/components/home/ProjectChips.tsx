import { WidgetCard } from "./WidgetCard";

export function ProjectChips({
  projects,
  selectedKeys,
  onToggle,
}: {
  projects: { key: string; name: string; count: number }[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <WidgetCard title="My projects" subtitle="Where you have active assignments">
        <p className="text-sm text-slate-500">No project activity in current scope.</p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="My projects" subtitle="Click to filter the dashboard">
      <div className="flex flex-wrap gap-2">
        {projects.map((p) => {
          const active = selectedKeys.includes(p.key);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onToggle(p.key)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? "bg-sky-100 border-sky-600 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100"
                  : "bg-slate-100 dark:bg-app-surface-muted/60 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
            >
              <span className="font-medium">{p.key}</span>
              <span className="text-slate-600 dark:text-slate-400 ml-1.5">{p.count}</span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
