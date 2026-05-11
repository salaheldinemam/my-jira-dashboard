import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { FiltersBar } from "../components/FiltersBar";
import { JiraIssueLink } from "../components/JiraIssueLink";
import type { IssueRow } from "../types";
import { useUiStore } from "../store";

function dedupeIssuesByKey(rows: IssueRow[]): IssueRow[] {
  const byKey = new Map<string, IssueRow>();
  for (const row of rows) {
    if (!byKey.has(row.key)) byKey.set(row.key, row);
  }
  return [...byKey.values()];
}

export function StoriesPage() {
  const { projectKeys } = useUiStore();
  const [stories, setStories] = useState<IssueRow[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const grouped = useMemo(() => {
    const next: Record<string, IssueRow[]> = {};
    for (const story of stories) {
      const key = story.status;
      if (!next[key]) next[key] = [];
      next[key].push(story);
    }
    return next;
  }, [stories]);

  useEffect(() => {
    setCollapsedSections((prev) => {
      const next: Record<string, boolean> = {};
      for (const group of Object.keys(grouped)) {
        next[group] = prev[group] ?? true;
      }
      return next;
    });
  }, [grouped]);

  async function loadStories() {
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    try {
      const qs = new URLSearchParams();
      qs.set("groupBy", "status");
      qs.set("statusFilter", "openInProgress");
      if (projectKeys.length) qs.set("projects", projectKeys.join(","));
      const res = await api<{ grouped: Record<string, IssueRow[]> }>(
        `/api/stories?${qs.toString()}`
      );
      setStories(dedupeIssuesByKey(Object.values(res.grouped).flat()));
    } catch (e) {
      setStories([]);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-2">Stories &amp; enhancements</h1>
      <p className="text-slate-400 text-sm mb-6">Open and in-progress stories and enhancements.</p>
      <FiltersBar onApply={loadStories} applyLabel="Load stories" showDateFilters={false} />
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-400">{error}</div>}
      {!loading && !error && !hasLoaded && (
        <div className="text-slate-500 text-sm">Set your filters, then click "Load stories".</div>
      )}
      {!loading && !error && (
        <div className="space-y-8">
          {Object.entries(grouped).map(([group, issues]) => (
            <div key={group}>
              <button
                type="button"
                onClick={() =>
                  setCollapsedSections((prev) => ({
                    ...prev,
                    [group]: !prev[group],
                  }))
                }
                className="text-sm font-medium text-sky-400 mb-2 flex items-center gap-2"
              >
                <span>{collapsedSections[group] ? "▸" : "▾"}</span>
                <span>{group}</span>
                <span className="text-slate-400">({issues.length})</span>
              </button>
              {!collapsedSections[group] && (
                <ul className="space-y-2">
                  {issues.map((i) => (
                    <li
                      key={i.key}
                      className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 flex flex-wrap gap-2 text-sm"
                    >
                      <JiraIssueLink
                        issueKey={i.key}
                        text={`${i.key} - ${i.summary}`}
                        className="font-mono text-sky-200 hover:underline"
                      />
                      <span className="text-slate-500">{i.assignee}</span>
                      <span className="text-slate-500">{i.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="text-slate-500 text-sm">No matching stories or enhancements.</div>
          )}
        </div>
      )}
    </div>
  );
}
