import type { HomeDashboard } from "../../types";
import { WidgetCard } from "./WidgetCard";

export function WeeklyReportPanel({ data }: { data: HomeDashboard }) {
  const { counts, byType, timeThisWeek } = data;
  const topTypes = Object.entries(byType)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <WidgetCard
      title="Weekly snapshot"
      subtitle="Print-friendly summary of your week"
      className="print:break-inside-avoid"
    >
      <div className="space-y-4 text-sm print:text-black">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ReportStat label="Assigned" value={counts.total} />
          <ReportStat label="In progress" value={counts.inProgress} />
          <ReportStat label="Overdue" value={counts.overdue} accent="danger" />
          <ReportStat label="Hours logged" value={timeThisWeek.totalHours} suffix="h" />
        </div>
        {topTypes.length > 0 ? (
          <div>
            <div className="text-xs text-slate-500 uppercase">Top issue types</div>
            <ul className="flex flex-wrap gap-2 mt-2">
              {topTypes.map(([k, v]) => (
                <li key={k} className="bg-slate-800 px-2 py-1 rounded text-slate-300 print:border">
                  {k}: <span className="text-white font-medium print:text-black">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-slate-500 print:text-gray-600">
          Generated {new Date().toLocaleString()} — assignee = you, unresolved only.
        </p>
      </div>
    </WidgetCard>
  );
}

function ReportStat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: "danger";
}) {
  return (
    <div className="rounded-lg bg-slate-800/50 p-3 print:border print:border-gray-300">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div
        className={`text-xl font-semibold mt-1 ${accent === "danger" ? "text-rose-300" : "text-white"} print:text-black`}
      >
        {value}
        {suffix}
      </div>
    </div>
  );
}
