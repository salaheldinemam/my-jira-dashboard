import type { AxiosInstance } from "axios";
import { fetchAllIssuesForJql } from "./fetchAllIssues.js";
import type { HomeWorklog } from "./homeAggregate.js";
import { jiraIssueWorklogs } from "./jiraClient.js";
import { isWorklogInWorkWeek, workWeekDateRange } from "./workWeek.js";

export async function fetchHomeWeekWorklogs(
  client: AxiosInstance,
  accountId: string,
  weekStart: Date,
  weekEndExclusive: Date
): Promise<HomeWorklog[]> {
  const { from: weekFrom, to: weekTo } = workWeekDateRange(weekStart);
  const startedAfter = weekStart.getTime();
  const startedBefore = weekEndExclusive.getTime();
  const jqlCandidates = [
    `worklogAuthor = currentUser() AND worklogDate >= "${weekFrom}" AND worklogDate <= "${weekTo}" ORDER BY updated DESC`,
    `worklogDate >= "${weekFrom}" AND worklogDate <= "${weekTo}" ORDER BY updated DESC`,
  ];

  const seen = new Set<string>();
  const worklogs: HomeWorklog[] = [];

  for (let i = 0; i < jqlCandidates.length; i++) {
    try {
      const issues = await fetchAllIssuesForJql(client, jqlCandidates[i], 200, [
        "summary",
        "status",
        "issuetype",
        "assignee",
      ]);
      for (const issue of issues) {
        try {
          const wl = await jiraIssueWorklogs(client, issue.id, { startedAfter, startedBefore });
          for (const w of wl.worklogs) {
            if (w.author.accountId !== accountId) continue;
            if (!isWorklogInWorkWeek(w.started, weekStart)) continue;
            const dedupeKey = `${issue.id}:${w.id}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            worklogs.push({
              started: w.started,
              timeSpentSeconds: w.timeSpentSeconds,
              authorAccountId: w.author.accountId,
            });
          }
        } catch {
          /* skip per-issue worklog errors */
        }
      }
      if (worklogs.length > 0 || i === jqlCandidates.length - 1) return worklogs;
    } catch {
      if (i === jqlCandidates.length - 1) return worklogs;
    }
  }

  return worklogs;
}
