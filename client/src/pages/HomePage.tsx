import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { projectQuery } from "../components/FiltersBar";
import { DueDateList } from "../components/home/DueDateList";
import { HomeProjectFilter } from "../components/home/HomeProjectFilter";
import { ProfileHeader } from "../components/home/ProfileHeader";
import { ProjectChips } from "../components/home/ProjectChips";
import { StatCard } from "../components/home/StatCard";
import { StatusChart } from "../components/home/StatusChart";
import { TestingQueuePanel } from "../components/home/TestingQueuePanel";
import { TimeWeekWidget } from "../components/home/TimeWeekWidget";
import { TypeBreakdown } from "../components/home/TypeBreakdown";
import { WidgetCard } from "../components/home/WidgetCard";
import { IssueTable } from "../components/IssueTable";
import { useUiStore } from "../store";
import type { AuthMe, HomeDashboard, IssueRow } from "../types";

export function HomePage() {
  const { projectKeys, setProjectKeys } = useUiStore();
  const [me, setMe] = useState<AuthMe | null>(null);
  const [data, setData] = useState<HomeDashboard | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingDash, setLoadingDash] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoadingDash(true);
    setError(null);
    try {
      const q = projectQuery(projectKeys);
      const dash = await api<HomeDashboard>(`/api/home/dashboard${q ? `?${q.slice(1)}` : ""}`);
      setData(dash);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoadingDash(false);
    }
  }, [projectKeys]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingMe(true);
      try {
        const auth = await api<AuthMe>("/api/auth/me");
        if (alive) setMe(auth);
      } catch {
        if (alive) setMe(null);
      } finally {
        if (alive) setLoadingMe(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  function toggleProjectChip(key: string) {
    if (projectKeys.includes(key)) setProjectKeys(projectKeys.filter((k) => k !== key));
    else setProjectKeys([...projectKeys, key]);
  }

  const counts = data?.counts;

  return (
    <div className="space-y-6">
      <ProfileHeader me={me} loading={loadingMe} avatarUrl={data?.user.avatarUrl} />
      <HomeProjectFilter />
      {error ? <p className="text-red-600 dark:text-red-400 text-sm">{error}</p> : null}
      {loadingDash && !data ? <p className="text-slate-500 text-sm">Loading your dashboard…</p> : null}
      {data ? (
        <HomeDashboardContent
          data={data}
          counts={counts}
          projectKeys={projectKeys}
          onToggleProject={toggleProjectChip}
        />
          ) : null}
    </div>
  );
}

function HomeDashboardContent({
  data,
  counts,
  projectKeys,
  onToggleProject,
}: {
  data: HomeDashboard;
  counts: HomeDashboard["counts"] | undefined;
  projectKeys: string[];
  onToggleProject: (key: string) => void;
}) {
  return (
    <>
      <HomeStatGrid counts={counts} />
      <div className="grid gap-6 lg:grid-cols-2">
        <StatusChart byStatus={data.byStatus} />
        <TypeBreakdown byType={data.byType} />
        <TimeWeekWidget totalHours={data.timeThisWeek.totalHours} byDay={data.timeThisWeek.byDay} />
        <ProjectChips projects={data.projects} selectedKeys={projectKeys} onToggle={onToggleProject} />
        <DueDateSection overdue={data.overdue} dueSoon={data.dueSoon} />
        <RecentIssuesSection issues={data.recentlyUpdated} />
        <TestingSection testing={data.testing} />
        <ActiveIssuesSection issues={data.issues} />
      </div>
    </>
  );
}

function HomeStatGrid({ counts }: { counts: HomeDashboard["counts"] | undefined }) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      <StatCard title="Open" value={counts?.open ?? 0} />
      <StatCard title="In progress" value={counts?.inProgress ?? 0} />
      <StatCard title="Ready for test" value={counts?.readyForTesting ?? 0} />
      <StatCard title="Under testing" value={counts?.underTesting ?? 0} />
      <StatCard
        title="Overdue"
        value={counts?.overdue ?? 0}
        accent={counts && counts.overdue > 0 ? "danger" : "default"}
      />
      <StatCard title="Total assigned" value={counts?.total ?? 0} />
    </div>
  );
}

function DueDateSection({ overdue, dueSoon }: { overdue: IssueRow[]; dueSoon: IssueRow[] }) {
  return (
    <div className="lg:col-span-2">
      <DueDateList overdue={overdue} dueSoon={dueSoon} />
    </div>
  );
}

function RecentIssuesSection({ issues }: { issues: IssueRow[] }) {
  return (
    <div className="lg:col-span-2">
      <WidgetCard title="Recently updated" subtitle="Last 10 tickets assigned to you">
        <IssueTable
          issues={issues}
          columns={["status", "type", "updated"]}
          emptyMessage="No recent updates"
        />
      </WidgetCard>
    </div>
  );
}

function TestingSection({ testing }: { testing: HomeDashboard["testing"] }) {
  return (
    <div className="lg:col-span-2">
      <TestingQueuePanel testing={testing} />
    </div>
  );
}

function ActiveIssuesSection({ issues }: { issues: IssueRow[] }) {
  return (
    <div className="lg:col-span-2">
      <WidgetCard title="My active issues" subtitle="Unresolved tickets assigned to you">
        <IssueTable
          issues={issues}
          columns={["status", "type", "priority", "project", "updated"]}
          emptyMessage="No active issues"
        />
      </WidgetCard>
    </div>
  );
}
