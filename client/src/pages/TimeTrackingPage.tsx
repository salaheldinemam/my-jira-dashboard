import { addDays, format, startOfDay } from "date-fns";
import { Fragment, useState } from "react";
import { api } from "../api";
import { FiltersBar, projectQuery, type PeriodMode } from "../components/FiltersBar";
import { JiraIssueLink } from "../components/JiraIssueLink";
import { useUiStore } from "../store";

function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function rangeForMode(mode: PeriodMode, dateFrom: string, dateTo: string) {
  const today = startOfDay(new Date());
  if (mode === "yesterday") {
    return { from: isoDate(addDays(today, -1)), to: isoDate(today) };
  }
  if (mode === "today") {
    return { from: isoDate(today), to: isoDate(addDays(today, 1)) };
  }
  return { from: dateFrom, to: dateTo };
}

type Row = {
  employee: string;
  totalLoggedHours: number;
  tasksCount: number;
  tasks: { key: string; summary: string; hours: number; status: string; type: string }[];
};

export function TimeTrackingPage() {
  const { projectKeys, dateFrom, dateTo } = useUiStore();
  const [dateMode, setDateMode] = useState<PeriodMode>("yesterday");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadTimeTracking(mode: PeriodMode = dateMode) {
    const { from, to } = rangeForMode(mode, dateFrom, dateTo);
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    try {
      const q =
        `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` + projectQuery(projectKeys);
      const res = await api<{ rows: Row[] }>(`/api/time-tracking${q}`);
      setRows(res.rows);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Time tracking</h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Effort by team member for worklogs in the selected period.</p>
      <FiltersBar
        onApply={() => void loadTimeTracking()}
        applyLabel="Load time tracking"
        applyDisabled={loading}
        periodMode={dateMode}
        onPeriodModeChange={setDateMode}
        showDateFilters={dateMode === "custom"}
      />
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600 dark:text-red-400">{error}</div>}
      {!loading && !error && !hasLoaded && (
        <div className="text-slate-500 text-sm">
          Select a period{dateMode === "custom" ? " and date range" : ""}, then click &quot;Load time tracking&quot;.
        </div>
      )}
      {!loading && !error && (
        <div className="app-table-wrap">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Total hours</th>
                <th className="px-4 py-3">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.employee}>
                  <tr
                    className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/80 cursor-pointer"
                    onClick={() => setOpen(open === r.employee ? null : r.employee)}
                  >
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{r.employee}</td>
                    <td className="px-4 py-3">{r.totalLoggedHours}h</td>
                    <td className="px-4 py-3">{r.tasksCount}</td>
                  </tr>
                  {open === r.employee && (
                    <tr className="bg-white dark:bg-slate-950/80">
                      <td colSpan={3} className="px-4 pb-4">
                        <div className="text-xs text-slate-500 mb-2">Tasks</div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-500">
                              <th className="text-left py-1 pr-2">Ticket</th>
                              <th className="text-left py-1 pr-2">Hours</th>
                              <th className="text-left py-1 pr-2">Status</th>
                              <th className="text-left py-1">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.tasks.map((t) => (
                              <tr key={t.key} className="text-slate-800 dark:text-slate-200 border-t border-slate-200 dark:border-slate-800">
                                <td className="py-1.5 pr-2 font-mono">
                                  <JiraIssueLink
                                    issueKey={t.key}
                                    text={`${t.key} - ${t.summary}`}
                                    className="text-sky-700 dark:text-sky-200 hover:underline"
                                  />
                                </td>
                                <td className="py-1.5 pr-2">{t.hours}h</td>
                                <td className="py-1.5 pr-2">{t.status}</td>
                                <td className="py-1.5">{t.type}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="p-6 text-slate-500 text-sm">No worklogs in this range.</div>}
        </div>
      )}
    </div>
  );
}
