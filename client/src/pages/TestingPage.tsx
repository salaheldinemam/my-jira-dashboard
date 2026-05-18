import { useState } from "react";
import { api } from "../api";
import { FiltersBar } from "../components/FiltersBar";
import { JiraIssueLink } from "../components/JiraIssueLink";
import type { IssueRow } from "../types";
import { useUiStore } from "../store";

type TestingViewKey = "failedTesting" | "underTesting" | "readyForTesting";

type TestingView = {
  byGroup: Record<string, IssueRow[]>;
  groupBy: "assignee" | "reporter";
};

type TestingAllRes = {
  views: Record<TestingViewKey, TestingView>;
};

type TestingTab = "failed" | "under" | "ready";

const TAB_TO_VIEW: Record<TestingTab, TestingViewKey> = {
  failed: "failedTesting",
  under: "underTesting",
  ready: "readyForTesting",
};

const EMPTY_VIEWS: Record<TestingViewKey, TestingView> = {
  failedTesting: { byGroup: {}, groupBy: "assignee" },
  underTesting: { byGroup: {}, groupBy: "reporter" },
  readyForTesting: { byGroup: {}, groupBy: "reporter" },
};

function formatUpdated(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function IssueTable({
  issues,
  groupBy,
  showUpdated = true,
}: {
  issues: IssueRow[];
  groupBy: "assignee" | "reporter";
  showUpdated?: boolean;
}) {
  const showAssigneeCol = groupBy === "reporter";
  const showReporterCol = groupBy === "assignee";

  return (
    <div className="app-table-wrap overflow-x-auto">
      <table className="w-full text-sm table-fixed min-w-[32rem]">
        <colgroup>
          <col className="w-[58%]" />
          {showReporterCol && <col className="w-[18%]" />}
          {showAssigneeCol && <col className="w-[18%]" />}
          {showUpdated && <col className="w-[14%]" />}
        </colgroup>
        <thead className="app-table-head w-full">
          <tr>
            <th className="px-3 py-2 text-left">Ticket</th>
            {showReporterCol && <th className="px-3 py-2 text-left">Reporter</th>}
            {showAssigneeCol && <th className="px-3 py-2 text-left">Assignee</th>}
            {showUpdated && <th className="px-3 py-2 text-left">Updated</th>}
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.key} className="app-table-row">
              <td className="px-3 py-2 align-top break-words">
                <JiraIssueLink
                  issueKey={i.key}
                  text={`${i.key} — ${i.summary}`}
                  className="font-mono text-sky-800 dark:text-sky-200 hover:underline"
                />
              </td>
              {showReporterCol && (
                <td className="px-3 py-2 align-top text-app-text-muted">{i.reporter || "—"}</td>
              )}
              {showAssigneeCol && (
                <td className="px-3 py-2 align-top text-app-text-muted">{i.assignee}</td>
              )}
              {showUpdated && (
                <td className="px-3 py-2 align-top text-app-text-muted text-xs whitespace-nowrap">
                  {formatUpdated(i.updated)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabPanelContent({
  byGroup,
  groupBy,
  showUpdated = true,
}: {
  byGroup: Record<string, IssueRow[]>;
  groupBy: "assignee" | "reporter";
  showUpdated?: boolean;
}) {
  if (Object.keys(byGroup).length === 0) {
    return <div className="text-slate-500 text-sm">No tickets in this view.</div>;
  }

  return (
    <div className="space-y-3">
      {Object.entries(byGroup)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, groupIssues]) => (
          <details
            key={label}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 open:bg-white/90 dark:bg-slate-900/60 open:[&_summary_.chevron]:rotate-90"
          >
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <span className="chevron text-slate-500 transition-transform inline-block">▸</span>
                <span>{label}</span>
                <span className="text-slate-500 font-normal">({groupIssues.length})</span>
              </span>
            </summary>
            <div className="px-3 pb-3">
              <IssueTable issues={groupIssues} groupBy={groupBy} showUpdated={showUpdated} />
            </div>
          </details>
        ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  accent,
  label,
}: {
  active: boolean;
  onClick: () => void;
  accent: "rose" | "sky" | "emerald";
  label: string;
}) {
  const border =
    accent === "rose" ? "border-rose-500" : accent === "sky" ? "border-sky-500" : "border-emerald-500";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
        active
          ? `${border} text-slate-900 dark:text-white bg-white/80 dark:bg-slate-900/80`
          : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

export function TestingPage() {
  const { projectKeys } = useUiStore();
  const [tab, setTab] = useState<TestingTab>("failed");
  const [views, setViews] = useState<Record<TestingViewKey, TestingView>>(EMPTY_VIEWS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadAllTesting() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ view: "all" });
      if (projectKeys.length) qs.set("projects", projectKeys.join(","));
      const res = await api<TestingAllRes>(`/api/testing?${qs.toString()}`);
      setViews(res.views);
      setHasLoaded(true);
    } catch (e) {
      setViews(EMPTY_VIEWS);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const activeView = views[TAB_TO_VIEW[tab]];
  const { byGroup, groupBy } = activeView;
  const showUpdated = tab !== "failed";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Testing pipeline</h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
        Failed tickets are grouped by assignee. Under testing and ready for testing tickets are grouped
        by reporter. Choose projects if needed, then click Refresh to load all tabs.
      </p>
      <FiltersBar showDateFilters={false} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => void loadAllTesting()}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-800">
        <TabButton active={tab === "failed"} onClick={() => setTab("failed")} accent="rose" label="Failed testing" />
        <TabButton active={tab === "under"} onClick={() => setTab("under")} accent="sky" label="Under testing" />
        <TabButton active={tab === "ready"} onClick={() => setTab("ready")} accent="emerald" label="Ready for testing" />
      </div>

      <div className="rounded-b-xl border border-t-0 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/30 p-4 min-h-[120px]">
        {loading && !hasLoaded && (
          <div className="text-slate-500 text-sm">Loading testing pipeline…</div>
        )}
        {!loading && !error && !hasLoaded && (
          <div className="text-slate-500 text-sm">Click Refresh to load the testing pipeline.</div>
        )}
        {hasLoaded && !error && (
          <TabPanelContent byGroup={byGroup} groupBy={groupBy} showUpdated={showUpdated} />
        )}
      </div>
    </div>
  );
}
