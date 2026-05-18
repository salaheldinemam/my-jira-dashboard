import { addDays, startOfDay } from "date-fns";
import type { JiraIssue } from "./jiraClient.js";
import { aggregateSummary, issueToRow } from "./aggregate.js";
import type { StatusMapping } from "./statusMapping.js";
import { statusesForKeys } from "./statusMapping.js";
import {
  isoDate,
  isWorklogInWorkWeek,
  workWeekStart,
  WORK_WEEK_LENGTH_DAYS,
  worklogCalendarDay,
} from "./workWeek.js";

export const HOME_STATUS_MAPPING: StatusMapping = {
    open: ["Open", "To Do", "Backlog", "New", "Selected for Development", "TO DO"],
    inProgress: ["In Progress", "Under investigation", "Waiting for Deployment", "Done Dev"],
  readyForTesting: [
    "Ready for testing"
  ],
  underTesting: ["In Testing"],
  reopened: ["Reopened"],
    failedTesting: ["Testing failed"],
  underInvestigation: ["Under Investigation", "Blocked", "On Hold", "Postponed"],
};

const FAILED_STATUSES = new Set(statusesForKeys(HOME_STATUS_MAPPING, ["failedTesting"]));
const READY_STATUSES = new Set(statusesForKeys(HOME_STATUS_MAPPING, ["readyForTesting"]));
const UNDER_TEST_STATUSES = new Set(statusesForKeys(HOME_STATUS_MAPPING, ["underTesting"]));

const TYPE_KEYS = ["Story", "Bug", "Task", "Enhancement"] as const;

/** Terminal / closed statuses omitted from home status and type charts. */
const HOME_CHART_EXCLUDED_STATUSES = new Set(
  [
    "Released",
    "Canceled",
    "Cancelled",
    "Testing Passed",
    "Issue Passed",
    "Done",
    "Not a bug"
  ].map((s) => s.toLowerCase())
);

function isHomeChartExcludedStatus(status: string): boolean {
  return HOME_CHART_EXCLUDED_STATUSES.has(status.trim().toLowerCase());
}

/** Status buckets for tickets still in development (home “My active issues”). */
export const HOME_ACTIVE_STATUS_BUCKETS = ["open", "inProgress", "reopened", "failedTesting", "underInvestigation"] as const;

export function homeActiveIssueStatuses(): string[] {
  return statusesForKeys(HOME_STATUS_MAPPING, [...HOME_ACTIVE_STATUS_BUCKETS]);
}

function parseDue(d: string | null | undefined): Date | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : startOfDay(new Date(t));
}

export type HomeWorklog = { started: string; timeSpentSeconds: number; authorAccountId: string };

export function aggregateHomeDashboard(
  issues: JiraIssue[],
  worklogs: HomeWorklog[],
  accountId: string,
  userMeta: { displayName?: string; email: string; avatarUrl?: string },
  activeIssues: JiraIssue[]
) {
  const agg = aggregateSummary(issues, HOME_STATUS_MAPPING);
  const rows = issues.map(issueToRow);
  const today = startOfDay(new Date());
  const weekStart = workWeekStart(today);
  const dueSoonEnd = addDays(today, 7);

  let overdue = 0;
  const dueSoonRows: ReturnType<typeof issueToRow>[] = [];
  const overdueRows: ReturnType<typeof issueToRow>[] = [];
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = { Story: 0, Bug: 0, Task: 0, Enhancement: 0 };
  const projectCounts = new Map<string, { key: string; name: string; count: number }>();

  const ready: ReturnType<typeof issueToRow>[] = [];
  const under: ReturnType<typeof issueToRow>[] = [];
  const failed: ReturnType<typeof issueToRow>[] = [];

  for (const row of rows) {
    if (!isHomeChartExcludedStatus(row.status)) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      const typ = row.issuetype;
      if (typ in byType) byType[typ]++;
      else {
        const k = TYPE_KEYS.find((t) => typ.toLowerCase().includes(t.toLowerCase()));
        if (k) byType[k]++;
      }
    }

    if (row.projectKey) {
      const existing = projectCounts.get(row.projectKey);
      if (existing) existing.count++;
      else
        projectCounts.set(row.projectKey, {
          key: row.projectKey,
          name: row.projectName ?? row.projectKey,
          count: 1,
        });
    }

    const due = parseDue(row.duedate);
    if (due) {
      if (due < today) {
        overdue++;
        overdueRows.push(row);
      } else if (due <= dueSoonEnd) {
        dueSoonRows.push(row);
      }
    }

    if (READY_STATUSES.has(row.status)) ready.push(row);
    if (UNDER_TEST_STATUSES.has(row.status)) under.push(row);
    if (FAILED_STATUSES.has(row.status)) failed.push(row);
  }

  const myWorklogs = worklogs.filter((w) => w.authorAccountId === accountId);
  let totalSeconds = 0;
  const byDayMap = new Map<string, number>();
  for (let i = 0; i < WORK_WEEK_LENGTH_DAYS; i++) {
    byDayMap.set(isoDate(addDays(weekStart, i)), 0);
  }

  for (const w of myWorklogs) {
    if (!isWorklogInWorkWeek(w.started, weekStart)) continue;
    totalSeconds += w.timeSpentSeconds;
    const day = worklogCalendarDay(w.started);
    if (!day) continue;
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + w.timeSpentSeconds);
  }

  const byDay = [...byDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, seconds]) => ({
      date,
      hours: Math.round((seconds / 3600) * 100) / 100,
    }));

  const issuesTable = activeIssues
    .map(issueToRow)
    .sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated))
    .slice(0, 50);
  const recentlyUpdated = [...rows]
    .sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated))
    .slice(0, 10);

  return {
    user: {
      displayName: userMeta.displayName,
      email: userMeta.email,
      accountId,
      avatarUrl: userMeta.avatarUrl,
    },
    counts: {
      open: agg.totalByStatus.open,
      inProgress: agg.totalByStatus.inProgress,
      readyForTesting: agg.totalByStatus.readyForTesting,
      underTesting: agg.totalByStatus.underTesting,
      reopened: agg.totalByStatus.reopened,
      failedTesting: agg.totalByStatus.failedTesting,
      overdue,
      total: issues.length,
    },
    byStatus,
    byType,
    issues: issuesTable,
    dueSoon: dueSoonRows.sort((a, b) => (a.duedate ?? "").localeCompare(b.duedate ?? "")),
    overdue: overdueRows.sort((a, b) => (a.duedate ?? "").localeCompare(b.duedate ?? "")),
    recentlyUpdated,
    projects: [...projectCounts.values()].sort((a, b) => b.count - a.count),
    testing: { ready, under, failed },
    timeThisWeek: {
      totalHours: Math.round((totalSeconds / 3600) * 100) / 100,
      byDay,
    },
  };
}
