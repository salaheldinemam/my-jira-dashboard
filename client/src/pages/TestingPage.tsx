import { useState } from "react";
import { api } from "../api";
import { FiltersBar } from "../components/FiltersBar";
import { JiraIssueLink } from "../components/JiraIssueLink";
import type { IssueRow } from "../types";
import { useUiStore } from "../store";

type TestingRes = {
  byGroup: Record<string, IssueRow[]>;
  groupBy: "assignee" | "reporter";
};

type TestingTab = "failed" | "under" | "ready";

function IssueTable({
  issues,
  groupBy,
  variant = "standard",
}: {
  issues: IssueRow[];
  groupBy: "assignee" | "reporter";
  variant?: "standard" | "failed";
}) {
  const showAssigneeCol = groupBy === "reporter";
  const showReporterCol = groupBy === "assignee";
  const showUpdated = variant !== "failed";
  const ticketThClass =
    variant === "failed"
      ? "px-3 py-2 text-left w-40 min-w-[10rem]"
      : "px-3 py-2 text-left";
  const ticketTdClass =
    variant === "failed"
      ? "px-3 py-2 font-mono text-sky-200 w-40 min-w-[10rem]"
      : "px-3 py-2 font-mono text-sky-200";
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table
        className={variant === "failed" ? "w-full text-sm table-fixed" : "w-full text-sm"}
      >
        <thead className="bg-slate-900 text-xs uppercase text-slate-500">
          <tr>
            <th className={ticketThClass}>Ticket</th>
            {showReporterCol && <th className="px-3 py-2 text-left">Reporter</th>}
            {showAssigneeCol && <th className="px-3 py-2 text-left">Assignee</th>}
            {showUpdated && <th className="px-3 py-2 text-left">Updated</th>}
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.key} className="border-t border-slate-800">
              <td className={ticketTdClass}>
                <JiraIssueLink issueKey={i.key} text={`${i.key} - ${i.summary}`} className="hover:underline" />
              </td>
              {showReporterCol && <td className="px-3 py-2 text-slate-400">{i.reporter}</td>}
              {showAssigneeCol && <td className="px-3 py-2 text-slate-400">{i.assignee}</td>}
              {showUpdated && <td className="px-3 py-2 text-slate-500 text-xs">{i.updated}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabPanelContent({
  loadLabel,
  onLoad,
  loading,
  error,
  hasLoaded,
  emptyHint,
  byGroup,
  groupBy,
  tableVariant = "standard",
}: {
  loadLabel: string;
  onLoad: () => void;
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  emptyHint: string;
  byGroup: Record<string, IssueRow[]>;
  groupBy: "assignee" | "reporter";
  tableVariant?: "standard" | "failed";
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onLoad}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm"
        >
          {loading ? "Loading…" : loadLabel}
        </button>
      </div>
      {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
      {!loading && !error && !hasLoaded && (
        <div className="text-slate-500 text-sm">{emptyHint}</div>
      )}
      {!loading && !error && hasLoaded && Object.keys(byGroup).length === 0 && (
        <div className="text-slate-500 text-sm">No tickets in this view.</div>
      )}
      <div className="space-y-3">
        {Object.entries(byGroup)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([label, issues]) => (
            <details
              key={label}
              className="rounded-xl border border-slate-800 bg-slate-900/40 open:bg-slate-900/60 open:[&_summary_.chevron]:rotate-90"
            >
              <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 text-sm font-medium text-slate-200 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <span className="chevron text-slate-500 transition-transform inline-block">▸</span>
                  <span>{label}</span>
                  <span className="text-slate-500 font-normal">({issues.length})</span>
                </span>
              </summary>
              <div className="px-3 pb-3">
                <IssueTable issues={issues} groupBy={groupBy} variant={tableVariant} />
              </div>
            </details>
          ))}
      </div>
    </div>
  );
}

export function TestingPage() {
  const { projectKeys } = useUiStore();
  const [tab, setTab] = useState<TestingTab>("failed");
  const [failedByGroup, setFailedByGroup] = useState<Record<string, IssueRow[]>>({});
  const [underByGroup, setUnderByGroup] = useState<Record<string, IssueRow[]>>({});
  const [readyByGroup, setReadyByGroup] = useState<Record<string, IssueRow[]>>({});
  const [failedError, setFailedError] = useState<string | null>(null);
  const [underError, setUnderError] = useState<string | null>(null);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [failedLoading, setFailedLoading] = useState(false);
  const [underLoading, setUnderLoading] = useState(false);
  const [readyLoading, setReadyLoading] = useState(false);
  const [failedLoaded, setFailedLoaded] = useState(false);
  const [underLoaded, setUnderLoaded] = useState(false);
  const [readyLoaded, setReadyLoaded] = useState(false);

  async function loadFailedTesting() {
    setFailedLoading(true);
    setFailedError(null);
    try {
      const qs = new URLSearchParams({ view: "failedTesting" });
      if (projectKeys.length) qs.set("projects", projectKeys.join(","));
      const res = await api<TestingRes>(`/api/testing?${qs.toString()}`);
      setFailedByGroup(res.byGroup);
      setFailedLoaded(true);
    } catch (e) {
      setFailedByGroup({});
      setFailedError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setFailedLoading(false);
    }
  }

  async function loadUnderTesting() {
    setUnderLoading(true);
    setUnderError(null);
    try {
      const qs = new URLSearchParams({ view: "underTesting" });
      if (projectKeys.length) qs.set("projects", projectKeys.join(","));
      const res = await api<TestingRes>(`/api/testing?${qs.toString()}`);
      setUnderByGroup(res.byGroup);
      setUnderLoaded(true);
    } catch (e) {
      setUnderByGroup({});
      setUnderError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setUnderLoading(false);
    }
  }

  async function loadReadyForTesting() {
    setReadyLoading(true);
    setReadyError(null);
    try {
      const qs = new URLSearchParams({ view: "readyForTesting" });
      if (projectKeys.length) qs.set("projects", projectKeys.join(","));
      const res = await api<TestingRes>(`/api/testing?${qs.toString()}`);
      setReadyByGroup(res.byGroup);
      setReadyLoaded(true);
    } catch (e) {
      setReadyByGroup({});
      setReadyError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setReadyLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-2">Testing pipeline</h1>
      <p className="text-slate-400 text-sm mb-6">
        Failed tickets are grouped by assignee. Under testing and ready for testing tickets are grouped
        by reporter. Switch tabs and load each view when needed.
      </p>
      <FiltersBar showDateFilters={false} />

      <div className="flex gap-1 mb-4 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setTab("failed")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
            tab === "failed"
              ? "border-rose-500 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Failed testing
        </button>
        <button
          type="button"
          onClick={() => setTab("under")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
            tab === "under"
              ? "border-sky-500 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Under testing
        </button>
        <button
          type="button"
          onClick={() => setTab("ready")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
            tab === "ready"
              ? "border-emerald-500 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Ready for testing
        </button>
      </div>

      <div className="rounded-b-xl border border-t-0 border-slate-800 bg-slate-900/30 p-4 min-h-[120px]">
        {tab === "failed" && (
          <TabPanelContent
            loadLabel="Load failed testing"
            onLoad={loadFailedTesting}
            loading={failedLoading}
            error={failedError}
            hasLoaded={failedLoaded}
            emptyHint='Choose projects if needed, then click "Load failed testing".'
            byGroup={failedByGroup}
            groupBy="assignee"
            tableVariant="failed"
          />
        )}
        {tab === "under" && (
          <TabPanelContent
            loadLabel="Load under testing"
            onLoad={loadUnderTesting}
            loading={underLoading}
            error={underError}
            hasLoaded={underLoaded}
            emptyHint='Choose projects if needed, then click "Load under testing".'
            byGroup={underByGroup}
            groupBy="reporter"
          />
        )}
        {tab === "ready" && (
          <TabPanelContent
            loadLabel="Load ready for testing"
            onLoad={loadReadyForTesting}
            loading={readyLoading}
            error={readyError}
            hasLoaded={readyLoaded}
            emptyHint='Choose projects if needed, then click "Load ready for testing".'
            byGroup={readyByGroup}
            groupBy="reporter"
          />
        )}
      </div>
    </div>
  );
}
