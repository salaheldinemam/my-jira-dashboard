import { Router, type Request } from "express";
import axios from "axios";
import { z } from "zod";
import { cacheGet, cacheSet, cacheInvalidatePrefix } from "../cache.js";
import { aggregateSummary, issueToRow } from "../aggregate.js";
import { aggregateHomeDashboard, homeActiveIssueStatuses } from "../homeAggregate.js";
import { fetchHomeWeekWorklogs } from "../homeWorklogs.js";
import {
  jiraGetMyself,
  jiraIssueWorklogs,
  jiraProjectList,
  jiraSearch,
  pickAvatarUrl,
  type JiraIssue,
} from "../jiraClient.js";
import {
  workWeekDateRange,
  workWeekEndExclusive,
  workWeekStart,
} from "../workWeek.js";
import { fetchAllIssuesForJql, TESTING_LIST_FIELDS } from "../fetchAllIssues.js";
import { resolveJiraClient } from "../jiraAuth.js";
import { getSessionAccountId, sessionHasJira } from "../session.js";
import {
  DEFAULT_STATUS_MAPPING,
  jqlStatusIn,
  jqlStatusNotIn,
  statusesForKeys,
} from "../statusMapping.js";

function sessionMeta(req: Request) {
  const jira = req.session?.jira;
  if (!sessionHasJira(req.session) || !jira) return null;
  return { baseUrl: jira.baseUrl, email: jira.email, authMode: jira.authMode };
}

/** Leading project filter for JQL (narrow index first). Empty string when no projects are selected. */
function projectJqlPrefix(projectKeys: string[]): string {
  if (projectKeys.length === 0) return "";
  return `project in (${projectKeys.map((k) => `"${k}"`).join(", ")}) AND `;
}

/** Limit workload view to this fixed assignee allowlist. Keep empty to include all assignees. */
const WORKLOAD_ASSIGNEE_ALLOWLIST: string[] = [
    "6033a446d416ea0070e3f14b",
    "712020:a13e4f12-9cf7-4292-a09b-cc37b0113f26",
    "712020:37a5ef47-deb3-47fa-ae48-9fa38a693d56",
    "712020:13800a1a-e7d1-43ef-91ee-8ca076ce3b8d",
    "712020:ed0426aa-8834-427c-9c9f-4b0e1aa088bc",
    "712020:ae3a32d5-63ff-48a3-9b9a-6e436aa321fd",
    "712020:a555265d-1dbe-4dac-9df6-f3403c5b95d3",
    "603cabb3da9309006a38330f",
    "712020:ab28997e-a72a-43d4-9c63-6d3ac1a4c731",
    "712020:f21b4fd5-c0ac-40d0-9199-a8a8ef74d2ba",
    "712020:6ad06041-6c9e-4ef2-9181-e77a7f3de8f1"
];

/// API routes, all prefixed with /api. Requires Jira credentials in session.
export function apiRouter(sessionSecret: string) {
  const r = Router();
  async function requireJira(req: Request) {
    return resolveJiraClient(req, sessionSecret);
  }
  function upstreamError(defaultMsg: string, e: unknown): string {
    if (axios.isAxiosError(e)) {
      const status = e.response?.status;
      const data = e.response?.data;
      let msg = status ? `${defaultMsg} (${status})` : defaultMsg;
      if (data && typeof data === "object") {
        const d = data as { errorMessages?: string[]; errors?: Record<string, string> };
        const detail = d.errorMessages?.join("; ") || Object.values(d.errors ?? {}).join("; ");
        if (detail) msg += `: ${detail}`;
      }
      return msg;
    }
    if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
    return defaultMsg;
  }

  r.get("/jira/base-url", (req, res) => {
    const meta = sessionMeta(req);
    if (!meta) {
      res.status(401).json({ error: "Not connected to Jira. Open Settings and sign in with Atlassian." });
      return;
    }
    res.json({ baseUrl: meta.baseUrl });
  });

  r.get("/projects", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Not connected to Jira. Open Settings and sign in with Atlassian." });
      return;
    }
    const meta = sessionMeta(req);
    const cacheKey = `projects:${meta?.baseUrl}:${meta?.email}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    try {
      const data = await jiraProjectList(client);
      cacheSet(cacheKey, data, 120_000);
      res.json(data);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("Failed to load projects", e) });
    }
  });

  const summaryQuery = z.object({
    projects: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  });

  r.get("/dashboard/summary", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Jira settings are missing. Open Settings and save your credentials." });
      return;
    }
    const q = summaryQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: q.error.flatten() });
      return;
    }
    const mapping = {
      open: ["Open", "To Do", "Backlog", "New", "Selected for Development"],
      inProgress: ["In Progress", "Doing", "Development", "Code Review"],
      readyForTesting: [
        "Ready for Testing",
        "Ready For Testing",
        "Ready to Test",
        "Ready For Test",
        "Ready for QA",
        "Ready For QA",
      ],
      underTesting: ["In Testing", "Under Testing", "QA", "Testing"],
      reopened: ["Reopened"],
      failedTesting: ["Failed Testing", "Failed QA", "Testing Failed"],
      underInvestigation: ["Under Investigation", "Blocked", "On Hold"],
    };
    const projectKeys = q.data.projects
      ? q.data.projects.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    const dateClause =
      q.data.from && q.data.to
        ? ` AND updated >= "${q.data.from}" AND updated <= "${q.data.to}"`
        : "";
    const jql = `${projectJqlPrefix(projectKeys)}assignee is not EMPTY${dateClause} ORDER BY updated DESC`;

    const cacheKey = `summary:${jql}`;
    const cached = cacheGet<unknown>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const issues = await fetchAllIssuesForJql(client, jql, Number.POSITIVE_INFINITY);
      const agg = aggregateSummary(issues, mapping);

      let totalLoggedSeconds = 0;
      if (q.data.from && q.data.to) {
        const fromMs = Date.parse(q.data.from);
        const toMs = Date.parse(q.data.to);
        for (const issue of issues) {
          try {
            const wl = await jiraIssueWorklogs(client, issue.id);
            for (const w of wl.worklogs) {
              const t = Date.parse(w.started);
              if (t >= fromMs && t <= toMs) totalLoggedSeconds += w.timeSpentSeconds;
            }
          } catch {
            /* skip worklog errors per issue */
          }
        }
      }

      const payload = {
        ...agg,
        totalLoggedHours: Math.round((totalLoggedSeconds / 3600) * 100) / 100,
        dateRange: q.data.from && q.data.to ? { from: q.data.from, to: q.data.to } : null,
        issueCount: issues.length,
      };
      cacheSet(cacheKey, payload, 45_000);
      res.json(payload);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("Summary failed", e) });
    }
  });

  const homeQuery = z.object({
    projects: z.string().optional(),
    refresh: z.enum(["1", "true"]).optional(),
  });

  r.get("/home/dashboard", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Jira settings are missing. Open Settings and save your credentials." });
      return;
    }
    const jira = req.session.jira;
    if (!jira) {
      res.status(401).json({ error: "Not connected to Jira." });
      return;
    }

    let accountId = getSessionAccountId(req.session);
    if (!accountId) {
      try {
        const me = await jiraGetMyself(client);
        accountId = me.accountId;
        jira.accountId = me.accountId;
        if (!jira.displayName && me.displayName) jira.displayName = me.displayName;
      } catch {
        res.status(401).json({ error: "Could not resolve Jira user. Reconnect in Settings." });
        return;
      }
    }

    const q = homeQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: q.error.flatten() });
      return;
    }

    const projectKeys = q.data.projects
      ? q.data.projects.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    const jql = `${projectJqlPrefix(projectKeys)}assignee = currentUser() AND resolution is empty ORDER BY updated DESC`;

    const activeStatuses = homeActiveIssueStatuses();
    const activeIssuesJql =
      activeStatuses.length > 0
        ? `${projectJqlPrefix(projectKeys)}assignee = currentUser() AND ${jqlStatusIn(activeStatuses)} ORDER BY updated DESC`
        : `${projectJqlPrefix(projectKeys)}assignee = currentUser() ORDER BY updated DESC`;

    const weekStart = workWeekStart();
    const weekEnd = workWeekEndExclusive(weekStart);
    const { from: weekFrom } = workWeekDateRange(weekStart);

    const cacheKey = `home:${jira.baseUrl}:${accountId}:${projectKeys.join(",")}:${weekFrom}`;
    const skipCache = q.data.refresh === "1" || q.data.refresh === "true";
    if (!skipCache) {
      const cached = cacheGet<unknown>(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }
    }

    try {
      const [issues, activeIssues] = await Promise.all([
        fetchAllIssuesForJql(client, jql, 500),
        fetchAllIssuesForJql(client, activeIssuesJql, 50),
      ]);

      const worklogs = await fetchHomeWeekWorklogs(client, accountId, weekStart, weekEnd);

      const payload = aggregateHomeDashboard(
        issues,
        worklogs,
        accountId,
        {
          displayName: jira.displayName,
          email: jira.email,
          avatarUrl: jira.avatarUrl,
        },
        activeIssues
      );
      cacheSet(cacheKey, payload, 30_000);
      res.json(payload);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("Home dashboard failed", e) });
    }
  });

  const workloadQuery = z.object({
    projects: z.string().optional(),
  });

  r.get("/workload/by-assignee", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Jira settings are missing. Open Settings and save your credentials." });
      return;
    }
    const q = workloadQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: q.error.flatten() });
      return;
    }
    const statuses = [
        "Open",
        "Reopened",
        "In Progress",
        "Testing Failed",
        "Under Investigation",
        "Postponed",
        "Blocked",
        "TO DO",
        "Done Dev",
        "New",
        "Backlog"
    ];
    const projectKeys = q.data.projects
      ? q.data.projects.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    const assigneeClause = WORKLOAD_ASSIGNEE_ALLOWLIST.length
      ? ` AND assignee in (${WORKLOAD_ASSIGNEE_ALLOWLIST.map((name) => `"${name.replace(/"/g, '\\"')}"`).join(", ")})`
      : "";
    const jql =
      `${projectJqlPrefix(projectKeys)}assignee is not EMPTY` +
      ` AND issuetype not in ("Story", "Enhancement")` +
      ` AND ${jqlStatusIn(statuses)}` +
      `${assigneeClause} ORDER BY assignee, updated DESC`;

    const cacheKey = `workload:${jql}`;
    const hit = cacheGet<unknown>(cacheKey);
    if (hit) {
      res.json(hit);
      return;
    }

    try {
      const issues = await fetchAllIssuesForJql(client, jql);
      const buckets: Record<string, JiraIssue[]> = {};
      const byAssignee: Record<string, Record<string, JiraIssue[]>> = {};
      for (const issue of issues) {
        const name = issueToRow(issue).assignee;
        const st =
          typeof issue.fields.status === "object" && issue.fields.status && "name" in issue.fields.status
            ? String((issue.fields.status as { name: string }).name)
            : "Unknown";
        if (!buckets[st]) buckets[st] = [];
        buckets[st].push(issue);
        if (!byAssignee[name]) byAssignee[name] = {};
        if (!byAssignee[name][st]) byAssignee[name][st] = [];
        byAssignee[name][st].push(issue);
      }
      const serializeBuckets = (b: Record<string, JiraIssue[]>) => {
        const out: Record<string, ReturnType<typeof issueToRow>[]> = {};
        for (const [k, iss] of Object.entries(b)) out[k] = iss.map(issueToRow);
        return out;
      };
      const byAssigneeRows: Record<string, ReturnType<typeof serializeBuckets>> = {};
      for (const [name, b] of Object.entries(byAssignee)) {
        byAssigneeRows[name] = serializeBuckets(b);
      }
      const payload = { buckets: serializeBuckets(buckets), byAssignee: byAssigneeRows };
      cacheSet(cacheKey, payload, 45_000);
      res.json(payload);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("Workload failed", e) });
    }
  });

  const TESTING_FAILED_STATUSES = new Set(
    statusesForKeys(DEFAULT_STATUS_MAPPING, ["failedTesting"])
  );
  const TESTING_UNDER_STATUSES = new Set(
    statusesForKeys(DEFAULT_STATUS_MAPPING, ["underTesting"])
  );
  const TESTING_READY_STATUSES = new Set(
    statusesForKeys(DEFAULT_STATUS_MAPPING, ["readyForTesting"])
  );
  type TestingRow = ReturnType<typeof issueToRow>;

  function testingJql(projectKeys: string[], statuses: string[]): string {
    return (
      `${projectJqlPrefix(projectKeys)}${jqlStatusIn(statuses)}` +
      ` AND assignee is not EMPTY ORDER BY updated DESC`
    );
  }

  function groupTestingByView(
    rows: TestingRow[],
    view: "failedTesting" | "underTesting" | "readyForTesting"
  ): Record<string, TestingRow[]> {
    const byGroup: Record<string, TestingRow[]> = {};
    if (view === "failedTesting") {
      for (const row of rows) {
        if (!byGroup[row.assignee]) byGroup[row.assignee] = [];
        byGroup[row.assignee].push(row);
      }
    } else {
      for (const row of rows) {
        const g = row.reporter.trim() || "Unknown";
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(row);
      }
    }
    return byGroup;
  }

  async function fetchTestingPipelineAll(
    client: NonNullable<Awaited<ReturnType<typeof requireJira>>>,
    projectKeys: string[]
  ) {
    const [failedIssues, underIssues, readyIssues] = await Promise.all([
      fetchAllIssuesForJql(
        client,
        testingJql(projectKeys, [...TESTING_FAILED_STATUSES]),
        5000,
        TESTING_LIST_FIELDS
      ),
      fetchAllIssuesForJql(
        client,
        testingJql(projectKeys, [...TESTING_UNDER_STATUSES]),
        5000,
        TESTING_LIST_FIELDS
      ),
      fetchAllIssuesForJql(
        client,
        testingJql(projectKeys, [...TESTING_READY_STATUSES]),
        5000,
        TESTING_LIST_FIELDS
      ),
    ]);
    return {
      views: {
        failedTesting: {
          byGroup: groupTestingByView(failedIssues.map(issueToRow), "failedTesting"),
          groupBy: "assignee" as const,
        },
        underTesting: {
          byGroup: groupTestingByView(underIssues.map(issueToRow), "underTesting"),
          groupBy: "reporter" as const,
        },
        readyForTesting: {
          byGroup: groupTestingByView(readyIssues.map(issueToRow), "readyForTesting"),
          groupBy: "reporter" as const,
        },
      },
    };
  }

  const testingQuery = z.object({
    projects: z.string().optional(),
    view: z
      .enum(["all", "underTesting", "readyForTesting", "failedTesting"])
      .default("all"),
  });

  r.get("/testing", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Jira settings are missing. Open Settings and save your credentials." });
      return;
    }
    const q = testingQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: q.error.flatten() });
      return;
    }
    const projectKeys = q.data.projects
      ? q.data.projects.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    const bucket = q.data.view;

    if (bucket === "all") {
      try {
        const payload = await fetchTestingPipelineAll(client, projectKeys);
        res.json(payload);
      } catch (e: unknown) {
        res.status(502).json({ error: upstreamError("Testing view failed", e) });
      }
      return;
    }

    const statuses =
      bucket === "failedTesting"
        ? [...TESTING_FAILED_STATUSES]
        : bucket === "readyForTesting"
          ? [...TESTING_READY_STATUSES]
          : [...TESTING_UNDER_STATUSES];
    if (!statuses.length) {
      res.json({ issues: [], byGroup: {}, groupBy: bucket === "failedTesting" ? "assignee" : "reporter" });
      return;
    }
    try {
      const issues = await fetchAllIssuesForJql(client, testingJql(projectKeys, statuses), 5000, TESTING_LIST_FIELDS);
      const rows = issues.map(issueToRow);
      const byGroup = groupTestingByView(rows, bucket);
      const payload = { issues: rows, byGroup, groupBy: bucket === "failedTesting" ? "assignee" : "reporter" };
      res.json(payload);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("Testing view failed", e) });
    }
  });

  const bugsQuery = z.object({
    projects: z.string().optional(),
  });

    const BUG_ACTIVE_STATUSES: string[] = [
        "Open",
        "Reopened",
        "In Progress",
        "Testing Failed",
        "Under Investigation",
        "Postponed",
        "Blocked",
        "TO DO",
        "Done Dev",
        "New",
        "Backlog"
    ];

  r.get("/bugs/by-assignee", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Jira settings are missing. Open Settings and save your credentials." });
      return;
    }
    const q = bugsQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: q.error.flatten() });
      return;
    }
    const projectKeys = q.data.projects
      ? q.data.projects.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    const jql =
      `${projectJqlPrefix(projectKeys)}issuetype = Bug` +
      ` AND ${jqlStatusIn(BUG_ACTIVE_STATUSES)}` +
      ` ORDER BY assignee, updated DESC`;

    const cacheKey = `bugs:${jql}`;
    const hit = cacheGet<unknown>(cacheKey);
    if (hit) {
      res.json(hit);
      return;
    }

    try {
      const issues = await fetchAllIssuesForJql(client, jql);
      const byAssignee: Record<string, Record<string, JiraIssue[]>> = {};
      for (const issue of issues) {
        const name = issueToRow(issue).assignee;
        const st =
          typeof issue.fields.status === "object" && issue.fields.status && "name" in issue.fields.status
            ? String((issue.fields.status as { name: string }).name)
            : "Unknown";
        if (!byAssignee[name]) byAssignee[name] = {};
        if (!byAssignee[name][st]) byAssignee[name][st] = [];
        byAssignee[name][st].push(issue);
      }
      const serializeBuckets = (b: Record<string, JiraIssue[]>) => {
        const out: Record<string, ReturnType<typeof issueToRow>[]> = {};
        for (const [k, iss] of Object.entries(b)) out[k] = iss.map(issueToRow);
        return out;
      };
      const byAssigneeRows: Record<string, ReturnType<typeof serializeBuckets>> = {};
      for (const [name, b] of Object.entries(byAssignee)) {
        byAssigneeRows[name] = serializeBuckets(b);
      }
      const payload = { byAssignee: byAssigneeRows };
      cacheSet(cacheKey, payload, 45_000);
      res.json(payload);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("Bugs view failed", e) });
    }
  });

  const storiesQuery = z.object({
    projects: z.string().optional(),
    groupBy: z.enum(["status", "assignee"]).default("status"),
    statusFilter: z.enum(["openInProgress", "all"]).default("openInProgress"),
  });

  /** Project QR, LV3 Production Ticket only, excluding terminal statuses. */
  r.get("/qr/lv3-production", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Jira settings are missing. Open Settings and save your credentials." });
      return;
    }
      const excluded = ["Testing Passed", "Released", "Canceled", "Cancelled", "Ready for testing"];
    const jql = `project = "QR" AND issuetype = "LV3 Production Ticket" AND ${jqlStatusNotIn(
      excluded
    )} ORDER BY assignee ASC, updated DESC`;
    const cacheKey = `qr-lv3:${jql}`;
    const hit = cacheGet<unknown>(cacheKey);
    if (hit) {
      res.json(hit);
      return;
    }
    try {
      const issues = await fetchAllIssuesForJql(client, jql);
      const rows = issues.map(issueToRow);
      const byAssignee: Record<string, typeof rows> = {};
      for (const row of rows) {
        const name = row.assignee;
        if (!byAssignee[name]) byAssignee[name] = [];
        byAssignee[name].push(row);
      }
      const payload = { byAssignee };
      cacheSet(cacheKey, payload, 45_000);
      res.json(payload);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("QR LV3 production list failed", e) });
    }
  });

  r.get("/stories", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Jira settings are missing. Open Settings and save your credentials." });
      return;
    }
    const q = storiesQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: q.error.flatten() });
      return;
    }
    const openStatuses = ["Open", "To Do", "Backlog", "New", "Selected for Development"];
    const inProgressStatuses = ["In Progress", "Doing", "Development", "Code Review"];
    const projectKeys = q.data.projects
      ? q.data.projects.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    const typeClause = `issuetype in ("Story", "Enhancement")`;
    let statusClause = "";
    if (q.data.statusFilter === "openInProgress") {
      const sts = [...new Set([...openStatuses, ...inProgressStatuses])];
      statusClause = sts.length ? ` AND ${jqlStatusIn(sts)}` : "";
    }
    const jql = `${projectJqlPrefix(projectKeys)}${typeClause}${statusClause} ORDER BY updated DESC`;
    const cacheKey = `stories:${jql}`;
    const hit = cacheGet<unknown>(cacheKey);
    if (hit) {
      res.json(hit);
      return;
    }
    try {
      const issues = await fetchAllIssuesForJql(client, jql);
      const rows = issues.map(issueToRow);
      let grouped: Record<string, typeof rows>;
      if (q.data.groupBy === "assignee") {
        grouped = {};
        for (const row of rows) {
          if (!grouped[row.assignee]) grouped[row.assignee] = [];
          grouped[row.assignee].push(row);
        }
      } else {
        grouped = {};
        for (const row of rows) {
          const k = row.status;
          if (!grouped[k]) grouped[k] = [];
          grouped[k].push(row);
        }
      }
      const payload = { issues: rows, grouped };
      cacheSet(cacheKey, payload, 45_000);
      res.json(payload);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("Stories failed", e) });
    }
  });

  const timeQuery = z.object({
    projects: z.string().optional(),
    from: z.string(),
    to: z.string(),
    sprint: z.string().optional(),
  });

  r.get("/time-tracking", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Jira settings are missing. Open Settings and save your credentials." });
      return;
    }
    const q = timeQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
      return;
    }
    const projectKeys = q.data.projects
      ? q.data.projects.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
    const sprintClause = q.data.sprint ? ` AND sprint = ${JSON.stringify(q.data.sprint)}` : "";
    const jql = `${projectJqlPrefix(projectKeys)}worklogDate >= "${q.data.from}" AND worklogDate <= "${q.data.to}"${sprintClause} ORDER BY updated DESC`;

    const cacheKey = `time:${jql}`;
    const hit = cacheGet<unknown>(cacheKey);
    if (hit) {
      res.json(hit);
      return;
    }

    const fromMs = Date.parse(q.data.from);
    const toMs = Date.parse(q.data.to);

    try {
      const searchRes = await jiraSearch(
        client,
        jql,
        ["summary", "status", "issuetype", "assignee"],
        { startAt: 0, maxResults: 100 }
      );
      let startAt = 0;
      const allIssues = [...searchRes.issues];
      while (startAt + searchRes.issues.length < searchRes.total && allIssues.length < 2000) {
        startAt += 100;
        const next = await jiraSearch(client, jql, ["summary", "status", "issuetype", "assignee"], {
          startAt,
          maxResults: 100,
        });
        allIssues.push(...next.issues);
        if (next.issues.length === 0) break;
      }

      type Emp = { seconds: number; tasks: { key: string; summary: string; hours: number; status: string; type: string }[] };
      const byEmployee: Record<string, Emp> = {};

      for (const issue of allIssues) {
        let wl;
        try {
          wl = await jiraIssueWorklogs(client, issue.id);
        } catch {
          continue;
        }
        const summary =
          typeof issue.fields.summary === "string" ? issue.fields.summary : "";
        const status =
          issue.fields.status && typeof issue.fields.status === "object" && "name" in issue.fields.status
            ? String((issue.fields.status as { name: string }).name)
            : "";
        const typ =
          issue.fields.issuetype && typeof issue.fields.issuetype === "object" && "name" in issue.fields.issuetype
            ? String((issue.fields.issuetype as { name: string }).name)
            : "";

        for (const w of wl.worklogs) {
          const t = Date.parse(w.started);
          if (t < fromMs || t > toMs) continue;
          const name = w.author.displayName ?? w.author.accountId ?? "Unknown";
          if (!byEmployee[name]) byEmployee[name] = { seconds: 0, tasks: [] };
          byEmployee[name].seconds += w.timeSpentSeconds;
          const hours = Math.round((w.timeSpentSeconds / 3600) * 100) / 100;
          const existing = byEmployee[name].tasks.find((x) => x.key === issue.key);
          if (existing) existing.hours += hours;
          else
            byEmployee[name].tasks.push({
              key: issue.key,
              summary,
              hours,
              status,
              type: typ,
            });
        }
      }

      const rows = Object.entries(byEmployee).map(([employee, v]) => ({
        employee,
        totalLoggedHours: Math.round((v.seconds / 3600) * 100) / 100,
        tasksCount: v.tasks.length,
        tasks: v.tasks.sort((a, b) => b.hours - a.hours),
      }));

      const payload = { rows };
      cacheSet(cacheKey, payload, 60_000);
      res.json(payload);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("Time tracking failed", e) });
    }
  });

  r.post("/cache/invalidate", (req, res) => {
    cacheInvalidatePrefix("");
    res.json({ ok: true });
  });

  r.post("/jql", async (req, res) => {
    const client = await requireJira(req);
    if (!client) {
      res.status(401).json({ error: "Jira settings are missing. Open Settings and save your credentials." });
      return;
    }
    const schema = z.object({
      jql: z.string().min(1),
      startAt: z.number().optional(),
      maxResults: z.number().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.flatten() });
      return;
    }
    try {
      const data = await jiraSearch(
        client,
        p.data.jql,
        ["summary", "status", "issuetype", "assignee", "reporter", "updated"],
        { startAt: p.data.startAt, maxResults: p.data.maxResults }
      );
      res.json(data);
    } catch (e: unknown) {
      res.status(502).json({ error: upstreamError("JQL failed", e) });
    }
  });

  return r;
}
