import type { AxiosInstance } from "axios";
import { jiraSearch, jiraSearchJql, type JiraIssue } from "./jiraClient.js";

const FIELDS = [
  "summary",
  "status",
  "issuetype",
  "assignee",
  "reporter",
  "updated",
  "duedate",
  "priority",
  "project",
];

const PAGE_SIZE = 100;
const PAGE_FETCH_CONCURRENCY = 6;

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

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchAllIssuesViaJqlApi(
  client: AxiosInstance,
  jql: string,
  maxCap: number,
  fields: string[]
): Promise<JiraIssue[]> {
  const all: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  do {
    const res = await jiraSearchJql(client, jql, fields, {
      maxResults: PAGE_SIZE,
      nextPageToken,
    });
    const batch = res.issues ?? [];
    all.push(...batch);
    if (all.length >= maxCap || batch.length === 0) break;
    if (res.isLast || !res.nextPageToken) break;
    nextPageToken = res.nextPageToken;
  } while (nextPageToken);

  return dedupeIssuesByKey(all.slice(0, maxCap));
}

async function fetchAllIssuesLegacyParallel(
  client: AxiosInstance,
  jql: string,
  maxCap: number,
  fields: string[]
): Promise<JiraIssue[]> {
  const first = await jiraSearch(client, jql, fields, { startAt: 0, maxResults: PAGE_SIZE });
  const all: JiraIssue[] = [...first.issues];
  const total = Math.min(first.total, maxCap);

  if (first.issues.length === 0 || all.length >= total) {
    return dedupeIssuesByKey(all);
  }

  const offsets: number[] = [];
  for (let startAt = first.issues.length; startAt < total; startAt += PAGE_SIZE) {
    offsets.push(startAt);
  }

  const pages = await mapPool(offsets, PAGE_FETCH_CONCURRENCY, (startAt) =>
    jiraSearch(client, jql, fields, { startAt, maxResults: PAGE_SIZE })
  );

  for (const page of pages) {
    all.push(...page.issues);
    if (all.length >= maxCap) break;
  }

  return dedupeIssuesByKey(all.slice(0, maxCap));
}

export async function fetchAllIssuesForJql(
  client: AxiosInstance,
  jql: string,
  maxCap = 5000,
  fields: string[] = FIELDS
): Promise<JiraIssue[]> {
  try {
    return await fetchAllIssuesViaJqlApi(client, jql, maxCap, fields);
  } catch {
    return fetchAllIssuesLegacyParallel(client, jql, maxCap, fields);
  }
}

/** Minimal fields for testing pipeline views (smaller Jira payloads). */
export const TESTING_LIST_FIELDS = ["summary", "status", "assignee", "reporter", "updated"];

export { FIELDS as JIRA_LIST_FIELDS };
