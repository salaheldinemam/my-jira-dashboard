import { useState } from "react";
import { api } from "../api";
import { FiltersBar } from "../components/FiltersBar";
import { JiraIssueLink } from "../components/JiraIssueLink";
import type { IssueRow } from "../types";
import { useUiStore } from "../store";

type Buckets = Record<string, IssueRow[]>;

function sortAssigneeKeys(keys: string[]): string[] {
  const named = keys.filter((k) => k !== "Unassigned").sort((a, b) => a.localeCompare(b));
  if (keys.includes("Unassigned")) named.push("Unassigned");
  return named;
}

export function BugsPage() {
  const { projectKeys } = useUiStore();
  const [byAssignee, setByAssignee] = useState<Record<string, Buckets>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openEmp, setOpenEmp] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadBugs() {
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    try {
      const u =
        projectKeys.length > 0
          ? `/api/bugs/by-assignee?projects=${encodeURIComponent(projectKeys.join(","))}`
          : "/api/bugs/by-assignee";
      const res = await api<{ byAssignee: Record<string, Buckets> }>(u);
      setByAssignee(res.byAssignee);
      setOpenEmp(null);
    } catch (e) {
      setByAssignee({});
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const assigneeKeys = sortAssigneeKeys(Object.keys(byAssignee));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Bugs</h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
        Open, reopened, under investigation, in progress, and testing failed bugs grouped by assignee
        (including unassigned).
      </p>
      <FiltersBar onApply={loadBugs} applyLabel="Load bugs" showDateFilters={false} />
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600 dark:text-red-400">{error}</div>}
      {!loading && !error && !hasLoaded && (
        <div className="text-slate-500 text-sm">Set your filters, then click &quot;Load bugs&quot;.</div>
      )}
      {!loading && !error && (
        <div className="space-y-3">
          {assigneeKeys.map((emp) => {
            const buckets = byAssignee[emp] ?? {};
            const ticketCount = Object.values(buckets).reduce((n, list) => n + list.length, 0);
            return (
              <div
                key={emp}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 flex justify-between items-center hover:bg-slate-100 dark:hover:bg-app-surface-muted/60"
                  onClick={() => setOpenEmp(openEmp === emp ? null : emp)}
                >
                  <span className="font-medium text-slate-900 dark:text-white">{emp}</span>
                  <span className="text-xs text-slate-500">{ticketCount} bugs</span>
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
                                  {issue.projectKey && (
                                    <span className="text-slate-500">{issue.projectKey}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
          {hasLoaded && assigneeKeys.length === 0 && (
            <div className="text-slate-500 text-sm">No matching bugs for the current filters.</div>
          )}
        </div>
      )}
    </div>
  );
}
