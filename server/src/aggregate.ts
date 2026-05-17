import type { JiraIssue } from "./jiraClient.js";
import type { StatusMapping } from "./statusMapping.js";
import { statusesForKeys } from "./statusMapping.js";

const TYPE_KEYS = ["Story", "Bug", "Task", "Enhancement"] as const;

function fieldString(issue: JiraIssue, name: string): string {
  const v = issue.fields[name];
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "name" in v && typeof (v as { name: unknown }).name === "string") {
    return String((v as { name: string }).name);
  }
  return "";
}

function fieldUserName(issue: JiraIssue): string {
  const a = issue.fields.assignee as { displayName?: string } | null | undefined;
  return a?.displayName ?? "Unassigned";
}

function fieldUpdated(issue: JiraIssue): string {
  const u = issue.fields.updated;
  return typeof u === "string" ? u : "";
}

export function aggregateSummary(
  issues: JiraIssue[],
  mapping: StatusMapping
) {
  const openS = new Set(statusesForKeys(mapping, ["open"]));
  const inProgS = new Set(statusesForKeys(mapping, ["inProgress"]));
  const readyTestS = new Set(statusesForKeys(mapping, ["readyForTesting"]));
  const testS = new Set(statusesForKeys(mapping, ["underTesting"]));
  const reopenS = new Set(statusesForKeys(mapping, ["reopened"]));
  const failS = new Set(statusesForKeys(mapping, ["failedTesting"]));

  let open = 0,
    inProgress = 0,
    readyForTesting = 0,
    underTesting = 0,
    reopened = 0,
    failedTesting = 0;
  const byType: Record<string, number> = { Story: 0, Bug: 0, Task: 0, Enhancement: 0 };

  for (const issue of issues) {
    const st = fieldString(issue, "status");
    if (openS.has(st)) open++;
    if (inProgS.has(st)) inProgress++;
    if (readyTestS.has(st)) readyForTesting++;
    if (testS.has(st)) underTesting++;
    if (reopenS.has(st)) reopened++;
    if (failS.has(st)) failedTesting++;

    const typ = fieldString(issue, "issuetype");
    if (typ in byType) byType[typ]++;
    else {
      const k = TYPE_KEYS.find((t) => typ.toLowerCase().includes(t.toLowerCase()));
      if (k) byType[k]++;
    }
  }

  const assignees = new Set<string>();
  for (const issue of issues) {
    const n = fieldUserName(issue);
    if (n !== "Unassigned") assignees.add(n);
  }

  return {
    totalByStatus: { open, inProgress, readyForTesting, underTesting, reopened, failedTesting },
    byType,
    activeMembers: assignees.size,
    assignees: [...assignees].sort(),
  };
}

export function groupIssuesByStatus(
  issues: JiraIssue[],
  mapping: StatusMapping,
  groupKeys: (keyof StatusMapping | string)[]
) {
  const buckets: Record<string, JiraIssue[]> = {};
  for (const k of groupKeys) buckets[k] = [];
  const statusToGroup = new Map<string, string>();
  for (const g of groupKeys) {
    for (const s of mapping[g] ?? []) statusToGroup.set(s, g);
  }
  for (const issue of issues) {
    const st = fieldString(issue, "status");
    const g = statusToGroup.get(st) ?? "other";
    if (!buckets[g]) buckets[g] = [];
    buckets[g].push(issue);
  }
  return buckets;
}

function fieldDuedate(issue: JiraIssue): string | null {
  const d = issue.fields.duedate;
  return typeof d === "string" ? d : null;
}

function fieldPriority(issue: JiraIssue): string {
  return fieldString(issue, "priority");
}

function fieldProject(issue: JiraIssue): { key: string; name: string } | null {
  const p = issue.fields.project as { key?: string; name?: string } | null | undefined;
  if (!p?.key) return null;
  return { key: p.key, name: p.name ?? p.key };
}

export function issueToRow(issue: JiraIssue) {
  const assignee = issue.fields.assignee as { displayName?: string; accountId?: string } | null;
  const reporter = issue.fields.reporter as { displayName?: string; accountId?: string } | null;
  const project = fieldProject(issue);
  return {
    key: issue.key,
    summary: typeof issue.fields.summary === "string" ? issue.fields.summary : "",
    status: fieldString(issue, "status"),
    issuetype: fieldString(issue, "issuetype"),
    assignee: assignee?.displayName ?? "Unassigned",
    assigneeAccountId: assignee?.accountId,
    reporter: reporter?.displayName ?? "",
    reporterAccountId: reporter?.accountId,
    updated: fieldUpdated(issue),
    duedate: fieldDuedate(issue),
    priority: fieldPriority(issue),
    projectKey: project?.key,
    projectName: project?.name,
  };
}
