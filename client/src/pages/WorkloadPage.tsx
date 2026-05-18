import { useState } from "react";
import { api } from "../api";
import { FiltersBar } from "../components/FiltersBar";
import { JiraIssueLink } from "../components/JiraIssueLink";
import type { IssueRow } from "../types";
import { useUiStore } from "../store";

type Buckets = Record<string, IssueRow[]>;

export function WorkloadPage() {
  const { projectKeys } = useUiStore();
  const [byAssignee, setByAssignee] = useState<Record<string, Buckets>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openEmp, setOpenEmp] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadWorkload() {
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    try {
      const u =
        projectKeys.length > 0
          ? `/api/workload/by-assignee?projects=${encodeURIComponent(projectKeys.join(","))}`
          : "/api/workload/by-assignee";
      const res = await api<{ buckets: Buckets; byAssignee: Record<string, Buckets> }>(u);
      setByAssignee(res.byAssignee);
    } catch (e) {
      setByAssignee({});
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Workload</h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">Tickets per assignee, grouped by Jira status.</p>
      <FiltersBar onApply={loadWorkload} applyLabel="Load workload" showDateFilters={false} />
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600 dark:text-red-400">{error}</div>}
      {!loading && !error && !hasLoaded && (
        <div className="text-slate-500 text-sm">Set your filters, then click "Load workload".</div>
      )}
      {!loading && !error && (
        <div className="space-y-3">
          {Object.entries(byAssignee).map(([emp, buckets]) => (
            <div key={emp} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 overflow-hidden">
              <button
                type="button"
                className="w-full text-left px-4 py-3 flex justify-between items-center hover:bg-slate-100 dark:hover:bg-app-surface-muted/60"
                onClick={() => setOpenEmp(openEmp === emp ? null : emp)}
              >
                <span className="font-medium text-slate-900 dark:text-white">{emp}</span>
                <span className="text-xs text-slate-500">
                  {Object.values(buckets).reduce((n, list) => n + list.length, 0)} tickets
                </span>
              </button>
              {openEmp === emp && (
                <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 space-y-4 bg-white dark:bg-slate-950/50">
                  {Object.entries(buckets)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([status, list]) => {
                    if (!list.length) return null;
                    return (
                      <div key={status}>
                        <div className="text-xs font-medium text-sky-400 mb-2">{status}</div>
                        <ul className="space-y-1 text-sm">
                          {list.map((issue) => (
                            <li key={issue.key} className="flex flex-wrap gap-2 text-slate-700 dark:text-slate-300">
                              <JiraIssueLink
                                issueKey={issue.key}
                                text={`${issue.key} - ${issue.summary}`}
                                className="font-mono text-sky-700 dark:text-sky-200 hover:underline"
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {Object.keys(byAssignee).length === 0 && (
            <div className="text-slate-500 text-sm">No assignee workload matched current filters.</div>
          )}
        </div>
      )}
    </div>
  );
}
