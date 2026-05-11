import { Fragment, useState } from "react";
import { api } from "../api";
import { FiltersBar, projectQuery } from "../components/FiltersBar";
import { JiraIssueLink } from "../components/JiraIssueLink";
import { useUiStore } from "../store";

type Row = {
  employee: string;
  totalLoggedHours: number;
  tasksCount: number;
  tasks: { key: string; summary: string; hours: number; status: string; type: string }[];
};

export function TimeTrackingPage() {
  const { projectKeys, dateFrom, dateTo } = useUiStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadTimeTracking() {
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    try {
      const q =
        `?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}` + projectQuery(projectKeys);
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
      <h1 className="text-2xl font-semibold text-white mb-2">Time tracking</h1>
      <p className="text-slate-400 text-sm mb-6">Effort by team member for worklogs in the date range.</p>
      <FiltersBar onApply={loadTimeTracking} applyLabel="Load time tracking" />
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-400">{error}</div>}
      {!loading && !error && !hasLoaded && (
        <div className="text-slate-500 text-sm">Set your filters, then click "Load time tracking".</div>
      )}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
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
                    className="border-t border-slate-800 hover:bg-slate-900/80 cursor-pointer"
                    onClick={() => setOpen(open === r.employee ? null : r.employee)}
                  >
                    <td className="px-4 py-3 text-white font-medium">{r.employee}</td>
                    <td className="px-4 py-3">{r.totalLoggedHours}h</td>
                    <td className="px-4 py-3">{r.tasksCount}</td>
                  </tr>
                  {open === r.employee && (
                    <tr className="bg-slate-950/80">
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
                              <tr key={t.key} className="text-slate-200 border-t border-slate-800">
                                <td className="py-1.5 pr-2 font-mono">
                                  <JiraIssueLink
                                    issueKey={t.key}
                                    text={`${t.key} - ${t.summary}`}
                                    className="text-sky-200 hover:underline"
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
