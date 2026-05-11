import { useState } from "react";
import { api } from "../api";
import { JiraIssueLink } from "../components/JiraIssueLink";
import type { IssueRow } from "../types";

function sortAssigneeKeys(keys: string[]): string[] {
  const named = keys.filter((k) => k !== "Unassigned").sort((a, b) => a.localeCompare(b));
  if (keys.includes("Unassigned")) named.push("Unassigned");
  return named;
}

export function QrLv3ProductionPage() {
  const [byAssignee, setByAssignee] = useState<Record<string, IssueRow[]>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    try {
      const res = await api<{ byAssignee: Record<string, IssueRow[]> }>("/api/qr/lv3-production");
      setByAssignee(res.byAssignee);
      setOpenSections({});
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
      <h1 className="text-2xl font-semibold text-white mb-2">QR — LV3 production tickets</h1>
      <p className="text-slate-400 text-sm mb-6">
        Project <span className="text-slate-300">QR</span>, type{" "}
        <span className="text-slate-300">LV3 Production Ticket</span>, excluding statuses Passed, Released,
        and Cancelled. Grouped by assignee.
      </p>
      <div className="mb-6">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-sky-700 text-white text-sm font-medium hover:bg-sky-600 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load tickets"}
        </button>
      </div>
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-400">{error}</div>}
      {!loading && !error && !hasLoaded && (
        <div className="text-slate-500 text-sm">Click &quot;Load tickets&quot; to fetch from Jira.</div>
      )}
      {!loading && !error && (
        <div className="space-y-3">
          {assigneeKeys.map((name) => {
            const issues = byAssignee[name] ?? [];
            const expanded = openSections[name] ?? false;
            return (
              <div key={name} className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 flex justify-between items-center gap-3 hover:bg-slate-800/60"
                  onClick={() => setOpenSections((prev) => ({ ...prev, [name]: !expanded }))}
                >
                  <span className="font-medium text-white flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 shrink-0">{expanded ? "▾" : "▸"}</span>
                    <span className="truncate">{name}</span>
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">{issues.length} tickets</span>
                </button>
                {expanded && (
                  <div className="border-t border-slate-800 px-4 py-3 bg-slate-950/50">
                    <ul className="space-y-2 text-sm">
                      {issues.map((issue) => (
                        <li
                          key={issue.key}
                          className="flex flex-wrap gap-2 text-slate-300 items-baseline"
                        >
                          <JiraIssueLink
                            issueKey={issue.key}
                            text={`${issue.key} - ${issue.summary}`}
                            className="font-mono text-sky-200 hover:underline shrink-0"
                          />
                          <span className="text-slate-500">({issue.status})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
          {hasLoaded && assigneeKeys.length === 0 && (
            <div className="text-slate-500 text-sm">No matching tickets.</div>
          )}
        </div>
      )}
    </div>
  );
}
