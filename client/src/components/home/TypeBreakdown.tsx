import { WidgetCard } from "./WidgetCard";
import { chartColor } from "./chartColors";

export function TypeBreakdown({ byType }: { byType: Record<string, number> }) {
  const entries = Object.entries(byType)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = entries.length ? Math.max(...entries.map(([, v]) => v)) : 0;

  if (entries.length === 0) {
    return (
      <WidgetCard title="Issue types" subtitle="Story, bug, task, and more">
        <p className="text-sm text-app-text-muted">No type data.</p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Issue types" subtitle="Story, bug, task, and more">
      <ul className="space-y-3">
        {entries.map(([label, value], i) => {
          const width = max > 0 ? `${Math.round((value / max) * 100)}%` : "0%";
          const color = chartColor(i);
          return (
            <li key={label}>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-app-text-secondary">{label}</span>
                  <span className="text-app-text font-medium tabular-nums">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-app-border overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width, backgroundColor: color }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
