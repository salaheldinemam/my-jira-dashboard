import { useState } from "react";
import { api } from "../api";
import { FiltersBar, projectQuery } from "../components/FiltersBar";
import { useUiStore } from "../store";

type Summary = {
  totalByStatus: {
    open: number;
    inProgress: number;
    readyForTesting: number;
    underTesting: number;
    reopened: number;
    failedTesting: number;
  };
  byType: Record<string, number>;
  activeMembers: number;
  assignees: string[];
  issueCount: number;
};

export function HomePage() {
  const { projectKeys } = useUiStore();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function loadSummary() {
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    try {
      const q = projectQuery(projectKeys);
      const s = await api<Summary>(
        `/api/dashboard/summary${q ? `?${q.slice(1)}` : ""}`,
      );
      setData(s);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white mb-2">Summary</h1>
      <p className="text-slate-400 text-sm mb-6">
        Snapshot of workload and ticket distribution for the selected projects.
      </p>
      <FiltersBar onApply={loadSummary} applyLabel="Load summary" showDateFilters={false} />
      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-400">{error}</div>}
      {!loading && !error && !hasLoaded && (
        <div className="text-slate-500 text-sm">Set your filters, then click "Load summary".</div>
      )}
      {data && !loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Stat title="Open" value={data.totalByStatus.open} />
          <Stat title="In progress" value={data.totalByStatus.inProgress} />
          <Stat title="Under testing" value={data.totalByStatus.underTesting} />
          <Stat title="Reopened" value={data.totalByStatus.reopened} />
          <Stat title="Active assignees" value={data.activeMembers} />
          <Stat title="Issues in scope" value={data.issueCount} />
          <TestingStatusWidget
            readyForTesting={data.totalByStatus.readyForTesting}
            testingFailed={data.totalByStatus.failedTesting}
          />
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-2 lg:col-span-3">
            <div className="text-sm text-slate-400 mb-3">Tickets by type</div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(data.byType).map(([k, v]) => (
                <span key={k} className="text-sm bg-slate-800 px-2 py-1 rounded-md">
                  <span className="text-slate-300">{k}</span>{" "}
                  <span className="text-white font-medium">{v}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat(props: { title: string; value: number; suffix?: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{props.title}</div>
      <div className="text-3xl font-semibold text-white mt-1">
        {props.value}
        {props.suffix ?? ""}
      </div>
      {props.subtitle && <div className="text-xs text-slate-500 mt-1">{props.subtitle}</div>}
    </div>
  );
}

function TestingStatusWidget(props: { readyForTesting: number; testingFailed: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-2 lg:col-span-3">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">Testing</div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-slate-400">Ready for testing</div>
          <div className="text-3xl font-semibold text-sky-200 mt-1">{props.readyForTesting}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Testing failed</div>
          <div className="text-3xl font-semibold text-rose-300 mt-1">{props.testingFailed}</div>
        </div>
      </div>
    </div>
  );
}
