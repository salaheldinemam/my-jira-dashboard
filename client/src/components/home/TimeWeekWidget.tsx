import { WidgetCard } from "./WidgetCard";
import { chartColor } from "./chartColors";

type Day = { date: string; hours: number };

export function TimeWeekWidget({
  totalHours,
  byDay,
}: {
  totalHours: number;
  byDay: Day[];
}) {
  const max = Math.max(...byDay.map((d) => d.hours), 0.25);

  return (
    <WidgetCard title="Time this week" subtitle="Hours you logged (Sun–Thu)">
      <div className="text-3xl font-semibold text-app-text mb-4">
        {totalHours}
        <span className="text-lg text-slate-600 dark:text-slate-400 font-normal ml-1">h</span>
      </div>
      <div className="flex items-end gap-2 h-28">
        {byDay.map((d, i) => {
          const heightPct = max > 0 ? (d.hours / max) * 100 : 0;
          const label = formatDayLabel(d.date);
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex-1 flex items-end">
                <WeekBar heightPct={heightPct} color={chartColor(i)} title={`${d.hours}h`} />
              </div>
              <span className="text-[10px] text-slate-500 truncate w-full text-center">{label}</span>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

function WeekBar({
  heightPct,
  color,
  title,
}: {
  heightPct: number;
  color: string;
  title: string;
}) {
  return (
    <div
      className="w-full rounded-t transition-all"
      style={{
        height: `${heightPct}%`,
        backgroundColor: color,
        minHeight: heightPct > 0 ? 4 : 0,
      }}
      title={title}
    />
  );
}

function formatDayLabel(iso: string) {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short" });
  } catch {
    return iso.slice(5);
  }
}
