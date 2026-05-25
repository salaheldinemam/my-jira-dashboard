import type { JiraIssue } from "./jiraClient.js";
import { aggregateSummary, issueToRow } from "./aggregate.js";
import { HOME_STATUS_MAPPING } from "./homeAggregate.js";
import { statusesForKeys } from "./statusMapping.js";

const TYPE_KEYS = ["Story", "Bug", "Task", "Enhancement"] as const;

const UNASSIGNED_EXCLUDED_TYPES = new Set(["Story", "Enhancement", "Epic"]);

const CHART_EXCLUDED_STATUSES = new Set(
  ["Released", "Canceled", "Cancelled", "Testing Passed", "Issue Passed", "Done", "Not a bug"].map((s) =>
    s.toLowerCase()
  )
);

const DONE_STATUSES = new Set(
  ["Released", "Testing Passed", "Issue Passed", "Done", "Canceled", "Cancelled", "Not a bug"].map((s) =>
    s.toLowerCase()
  )
);

const FAILED_STATUSES = new Set(statusesForKeys(HOME_STATUS_MAPPING, ["failedTesting"]));
const READY_STATUSES = new Set(statusesForKeys(HOME_STATUS_MAPPING, ["readyForTesting"]));
const UNDER_TEST_STATUSES = new Set(statusesForKeys(HOME_STATUS_MAPPING, ["underTesting"]));
const BLOCKED_STATUSES = new Set(statusesForKeys(HOME_STATUS_MAPPING, ["underInvestigation"]));

function isChartExcluded(status: string): boolean {
  return CHART_EXCLUDED_STATUSES.has(status.trim().toLowerCase());
}

function isDone(status: string): boolean {
  return DONE_STATUSES.has(status.trim().toLowerCase());
}

function isBlocked(status: string): boolean {
  const s = status.trim();
  if (BLOCKED_STATUSES.has(s)) return true;
  return s.toLowerCase().includes("blocked");
}

function countsTowardUnassigned(issuetype: string): boolean {
  return !UNASSIGNED_EXCLUDED_TYPES.has(issuetype);
}

export type SprintMeta = {
  id: number;
  name: string;
  state?: string;
  startDate?: string;
  endDate?: string;
};

export function aggregateSprintDashboard(issues: JiraIssue[], sprint: SprintMeta) {
  const agg = aggregateSummary(issues, HOME_STATUS_MAPPING);
  const rows = issues.map(issueToRow);

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = { Story: 0, Bug: 0, Task: 0, Enhancement: 0 };
  const groupedByStatus: Record<string, ReturnType<typeof issueToRow>[]> = {};
  const byAssignee: Record<string, Record<string, ReturnType<typeof issueToRow>[]>> = {};

  const ready: ReturnType<typeof issueToRow>[] = [];
  const under: ReturnType<typeof issueToRow>[] = [];
  const failed: ReturnType<typeof issueToRow>[] = [];
  const unassigned: ReturnType<typeof issueToRow>[] = [];
  const blocked: ReturnType<typeof issueToRow>[] = [];

  let done = 0;
  let unassignedCount = 0;
  let blockedCount = 0;

  for (const row of rows) {
    if (!groupedByStatus[row.status]) groupedByStatus[row.status] = [];
    groupedByStatus[row.status].push(row);

    const assignee = row.assignee;
    if (!byAssignee[assignee]) byAssignee[assignee] = {};
    if (!byAssignee[assignee][row.status]) byAssignee[assignee][row.status] = [];
    byAssignee[assignee][row.status].push(row);

    if (!isChartExcluded(row.status)) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      const typ = row.issuetype;
      if (typ in byType) byType[typ]++;
      else {
        const k = TYPE_KEYS.find((t) => typ.toLowerCase().includes(t.toLowerCase()));
        if (k) byType[k]++;
      }
    }

    if (isDone(row.status)) done++;
    if (row.assignee === "Unassigned" && countsTowardUnassigned(row.issuetype)) {
      unassignedCount++;
      unassigned.push(row);
    }
    if (isBlocked(row.status)) {
      blockedCount++;
      blocked.push(row);
    }

    if (READY_STATUSES.has(row.status)) ready.push(row);
    if (UNDER_TEST_STATUSES.has(row.status)) under.push(row);
    if (FAILED_STATUSES.has(row.status)) failed.push(row);
  }

  const total = rows.length;
  const completionPercent = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;

  return {
    sprint,
    counts: {
      total,
      done,
      open: agg.totalByStatus.open,
      inProgress: agg.totalByStatus.inProgress,
      readyForTesting: agg.totalByStatus.readyForTesting,
      underTesting: agg.totalByStatus.underTesting,
      reopened: agg.totalByStatus.reopened,
      failedTesting: agg.totalByStatus.failedTesting,
      unassigned: unassignedCount,
      blocked: blockedCount,
    },
    completionPercent,
    byStatus,
    byType,
    testing: { ready, under, failed },
    unassigned,
    blocked,
    issues: rows,
    groupedByStatus,
    byAssignee,
  };
}
