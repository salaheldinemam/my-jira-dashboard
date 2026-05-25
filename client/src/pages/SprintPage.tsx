import { useMemo, useState } from "react";
import { api } from "../api";
import { SprintFiltersBar } from "../components/SprintFiltersBar";
import { StatCard } from "../components/home/StatCard";
import { StatusChart } from "../components/home/StatusChart";
import { TestingQueuePanel } from "../components/home/TestingQueuePanel";
import { TypeBreakdown } from "../components/home/TypeBreakdown";
import { WidgetCard } from "../components/home/WidgetCard";
import { IssueTable } from "../components/IssueTable";
import { JiraIssueLink } from "../components/JiraIssueLink";
import { useUiStore } from "../store";
import type { IssueRow, SprintDashboard, SprintOption } from "../types";

type TabId = "all" | "status" | "assignee";

function sortAssigneeKeys(keys: string[]): string[] {
  const named = keys.filter((k) => k !== "Unassigned").sort((a, b) => a.localeCompare(b));
  if (keys.includes("Unassigned")) named.push("Unassigned");
  return named;
}

export function SprintPage() {
  const { projectKeys, sprintId } = useUiStore();
  const [data, setData] = useState<SprintDashboard | null>(null);
  const [selectedSprint, setSelectedSprint] = useState<SprintOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [tab, setTab] = useState<TabId>("all");
  const [filterType, setFilterType] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [openEmp, setOpenEmp] = useState<string | null>(null);
  const [collapsedStatus, setCollapsedStatus] = useState<Record<string, boolean>>({});

  const filteredIssues = useMemo(() => {
    if (!data) return [];
    return data.issues.filter((row) => {
      if (filterType && row.issuetype !== filterType) return false;
      if (filterAssignee && row.assignee !== filterAssignee) return false;
      if (filterStatus && row.status !== filterStatus) return false;
      return true;
    });
  }, [data, filterType, filterAssignee, filterStatus]);

  const filterOptions = useMemo(() => {
    if (!data) return { types: [] as string[], assignees: [] as string[], statuses: [] as string[] };
    const types = new Set<string>();
    const assignees = new Set<string>();
    const statuses = new Set<string>();
    for (const row of data.issues) {
      types.add(row.issuetype);
      assignees.add(row.assignee);
      statuses.add(row.status);
    }
    return {
      types: [...types].sort(),
      assignees: sortAssigneeKeys([...assignees]),
      statuses: [...statuses].sort(),
    };
  }, [data]);

  const filteredByStatus = useMemo(() => {
    const next: Record<string, IssueRow[]> = {};
    for (const row of filteredIssues) {
      if (!next[row.status]) next[row.status] = [];
      next[row.status].push(row);
    }
    return next;
  }, [filteredIssues]);

  const filteredByAssignee = useMemo(() => {
    const next: Record<string, Record<string, IssueRow[]>> = {};
    for (const row of filteredIssues) {
      if (!next[row.assignee]) next[row.assignee] = {};
      if (!next[row.assignee][row.status]) next[row.assignee][row.status] = [];
      next[row.assignee][row.status].push(row);
    }
    return next;
  }, [filteredIssues]);

  async function loadDashboard() {
    if (!projectKeys.length || !sprintId) return;
    setLoading(true);
    setError(null);
    setHasLoaded(true);
    try {
      const qs = new URLSearchParams();
      qs.set("sprintId", String(sprintId));
      qs.set("projects", projectKeys.join(","));
      const sprintRes = await api<{ sprints: SprintOption[] }>(
        `/api/sprints?projects=${encodeURIComponent(projectKeys.join(","))}`
      );
      const match = sprintRes.sprints.find((s) => s.id === sprintId) ?? null;
      setSelectedSprint(match);
      if (match?.name) qs.set("sprintName", match.name);

      const dash = await api<SprintDashboard>(`/api/sprint/dashboard?${qs.toString()}`);
      if (match) {
        dash.sprint = {
          ...dash.sprint,
          name: match.name,
          state: match.state,
          startDate: match.startDate,
          endDate: match.endDate,
        };
      }
      setData(dash);
      setOpenEmp(null);
      const collapsed: Record<string, boolean> = {};
      for (const status of Object.keys(dash.groupedByStatus)) collapsed[status] = true;
      setCollapsedStatus(collapsed);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load sprint dashboard");
    } finally {
      setLoading(false);
    }
  }

  const sprintHeader = data?.sprint ?? selectedSprint;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Sprint</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Open sprint dashboard: full ticket status, completion, testing queue, and workload for the
          selected sprint.
        </p>
      </div>

      <SprintFiltersBar onApply={loadDashboard} applyDisabled={loading} />

      {loading && <div className="text-slate-500">Loading…</div>}
      {error && <div className="text-red-600 dark:text-red-400">{error}</div>}
      {!loading && !error && !hasLoaded && (
        <div className="text-slate-500 text-sm">
          Select project(s) and a sprint, then click &quot;Load sprint dashboard&quot;.
        </div>
      )}

      {data && !loading && (
        <>
          <div className="app-card p-4">
            <h2 className="text-lg font-semibold text-app-text">{sprintHeader?.name ?? "Sprint"}</h2>
            <p className="text-sm text-app-text-muted mt-1">
              {sprintHeader?.state ? <span className="capitalize">{sprintHeader.state}</span> : null}
              {sprintHeader?.startDate || sprintHeader?.endDate ? (
                <>
                  {" "}
                  ·{" "}
                  {sprintHeader.startDate?.slice(0, 10) ?? "—"} → {sprintHeader.endDate?.slice(0, 10) ?? "—"}
                </>
              ) : null}
              {selectedSprint?.boardName ? <> · {selectedSprint.boardName}</> : null}
            </p>
          </div>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <StatCard title="Total" value={data.counts.total} />
            <StatCard title="Done" value={data.counts.done} />
            <StatCard title="In progress" value={data.counts.inProgress} />
            <StatCard title="Open" value={data.counts.open} />
            <StatCard
              title="Unassigned"
              value={data.counts.unassigned}
              accent={data.counts.unassigned > 0 ? "warning" : "default"}
            />
            <StatCard
              title="Blocked"
              value={data.counts.blocked}
              accent={data.counts.blocked > 0 ? "danger" : "default"}
            />
            <StatCard title="Ready for test" value={data.counts.readyForTesting} />
            <StatCard title="Under testing" value={data.counts.underTesting} />
            <StatCard title="Failed testing" value={data.counts.failedTesting} />
            <StatCard title="Reopened" value={data.counts.reopened} />
          </div>

          <WidgetCard title="Sprint completion" subtitle={`${data.completionPercent}% of issues in done statuses`}>
            <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-600 dark:bg-sky-500 transition-all"
                style={{ width: `${Math.min(100, data.completionPercent)}%` }}
              />
            </div>
            <p className="text-sm text-app-text-muted mt-2 tabular-nums">
              {data.counts.done} / {data.counts.total} issues
            </p>
          </WidgetCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <StatusChart byStatus={data.byStatus} />
            <TypeBreakdown byType={data.byType} />
          </div>

          <TestingQueuePanel
            testing={data.testing}
            title="Sprint testing queue"
            subtitle="Ready, in test, and failed testing tickets in this sprint"
            tableColumns={["status"]}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <WidgetCard title="Unassigned" subtitle="Unassigned issues (excludes Story, Enhancement, Epic)">
              <IssueTable
                issues={data.unassigned}
                columns={["status", "type"]}
                emptyMessage="No unassigned issues"
              />
            </WidgetCard>
            <WidgetCard title="Blocked / on hold" subtitle="Blocked and investigation statuses">
              <IssueTable
                issues={data.blocked}
                columns={["status", "type", "assignee"]}
                emptyMessage="No blocked issues"
              />
            </WidgetCard>
          </div>

          <WidgetCard title="Sprint issues" subtitle="Filter and browse all tickets in the sprint">
            <div className="flex flex-wrap gap-3 mb-4 text-sm">
              <label className="flex flex-col gap-1 text-xs text-app-text-muted">
                Type
                <select
                  className="app-input px-2 py-1"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions.types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-app-text-muted">
                Assignee
                <select
                  className="app-input px-2 py-1"
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions.assignees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-app-text-muted">
                Status
                <select
                  className="app-input px-2 py-1"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions.statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex gap-1 mb-4 p-1 rounded-lg border border-app-border bg-app-surface-muted w-fit">
              {(
                [
                  { id: "all" as const, label: "All issues" },
                  { id: "status" as const, label: "By status" },
                  { id: "assignee" as const, label: "By assignee" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    tab === t.id
                      ? "bg-app-surface text-app-text shadow-sm font-medium border border-app-border"
                      : "text-app-text-muted hover:text-app-text"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "all" && (
              <IssueTable
                issues={filteredIssues}
                columns={["status", "type", "assignee", "priority"]}
                emptyMessage="No issues match filters"
              />
            )}

            {tab === "status" && (
              <div className="space-y-4">
                {Object.entries(filteredByStatus)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([status, issues]) => (
                    <div key={status}>
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedStatus((prev) => ({ ...prev, [status]: !prev[status] }))
                        }
                        className="text-sm font-medium text-sky-400 mb-2 flex items-center gap-2"
                      >
                        <span>{collapsedStatus[status] ? "▸" : "▾"}</span>
                        <span>{status}</span>
                        <span className="text-slate-500">({issues.length})</span>
                      </button>
                      {!collapsedStatus[status] && (
                        <ul className="space-y-1 text-sm">
                          {issues.map((issue) => (
                            <li key={issue.key} className="text-slate-700 dark:text-slate-300">
                              <JiraIssueLink
                                issueKey={issue.key}
                                text={`${issue.key} — ${issue.summary}`}
                                className="font-mono text-sky-700 dark:text-sky-200 hover:underline"
                              />
                              <span className="text-slate-500 ml-2">{issue.assignee}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                {Object.keys(filteredByStatus).length === 0 && (
                  <p className="text-sm text-slate-500">No issues match filters.</p>
                )}
              </div>
            )}

            {tab === "assignee" && (
              <div className="space-y-3">
                {sortAssigneeKeys(Object.keys(filteredByAssignee)).map((emp) => {
                  const buckets = filteredByAssignee[emp] ?? {};
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
                        <span className="text-xs text-slate-500">{ticketCount} tickets</span>
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
                                      <li key={issue.key} className="text-slate-700 dark:text-slate-300">
                                        <JiraIssueLink
                                          issueKey={issue.key}
                                          text={`${issue.key} — ${issue.summary}`}
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
                  );
                })}
                {Object.keys(filteredByAssignee).length === 0 && (
                  <p className="text-sm text-slate-500">No issues match filters.</p>
                )}
              </div>
            )}
          </WidgetCard>
        </>
      )}
    </div>
  );
}
