import type { AxiosInstance } from "axios";
import { jiraSearch, type JiraIssue } from "./jiraClient.js";

const FIELDS = [
  "summary",
  "status",
  "issuetype",
  "assignee",
  "reporter",
  "updated",
];

/** Same issue can appear on multiple pages if the result set shifts between requests (Jira pagination quirk). */
function dedupeIssuesByKey(issues: JiraIssue[]): JiraIssue[] {
  const seen = new Set<string>();
  const out: JiraIssue[] = [];
  for (const issue of issues) {
    if (seen.has(issue.key)) continue;
    seen.add(issue.key);
    out.push(issue);
  }
  return out;
}

export async function fetchAllIssuesForJql(
  client: AxiosInstance,
  jql: string,
  maxCap = 5000,
  fields: string[] = FIELDS
): Promise<JiraIssue[]> {
  const all: JiraIssue[] = [];
  let startAt = 0;
  const pageSize = 100;
  while (all.length < maxCap) {
    const res = await jiraSearch(client, jql, fields, { startAt, maxResults: pageSize });
    all.push(...res.issues);
    startAt += res.issues.length;
    if (startAt >= res.total || res.issues.length === 0) break;
  }
  return dedupeIssuesByKey(all);
}

export { FIELDS as JIRA_LIST_FIELDS };
