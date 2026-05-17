import { WidgetCard } from "./WidgetCard";
import { chartColor } from "./chartColors";

export function StatusChart({ byStatus }: { byStatus: Record<string, number> }) {
  const entries = Object.entries(byStatus)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (total === 0) {
    return (
      <WidgetCard title="Status distribution" subtitle="Your assigned unresolved issues">
        <p className="text-sm text-slate-500">No issues to chart.</p>
      </WidgetCard>
    );
  }

  let offset = 0;
  const slices = entries.map(([label, value], i) => {
    const pct = value / total;
    const dash = pct * 100;
    const slice = { label, value, color: chartColor(i), dash, offset };
    offset += dash;
    return slice;
  });

  const gradient = slices
    .map((s) => `${s.color} ${s.offset}% ${s.offset + s.dash}%`)
    .join(", ");

  return (
    <WidgetCard title="Status distribution" subtitle="Your assigned unresolved issues">
      <div className="flex flex-col sm:flex-row gap-6 items-center">
        <div
          className="w-36 h-36 rounded-full shrink-0"
          style={{ background: `conic-gradient(${gradient})` }}
          role="img"
          aria-label="Issue status distribution"
        />
        <ul className="flex-1 space-y-2 text-sm min-w-0">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-slate-300 truncate flex-1">{s.label}</span>
              <span className="text-white font-medium tabular-nums">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetCard>
  );
}
