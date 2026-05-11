import axios, { type AxiosInstance } from "axios";

export type JiraCredentials = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

export function createJiraClient(creds: JiraCredentials): AxiosInstance {
  const auth = Buffer.from(`${creds.email}:${creds.apiToken}`).toString("base64");
  const baseURL = creds.baseUrl.replace(/\/$/, "");
  return axios.create({
    baseURL: `${baseURL}/rest/api`,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: 60_000,
  });
}

type ApiVersion = "3" | "2";

function isRetryableVersionError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  return status === 404 || status === 410;
}

async function withVersionFallback<T>(
  client: AxiosInstance,
  fn: (v: ApiVersion) => Promise<T>
): Promise<T> {
  try {
    return await fn("3");
  } catch (err) {
    if (!isRetryableVersionError(err)) throw err;
    return fn("2");
  }
}

export async function jiraGetMyself(client: AxiosInstance) {
  return withVersionFallback(client, async (v) => {
    const { data } = await client.get(`/${v}/myself`);
    return data as { accountId: string; displayName?: string; emailAddress?: string };
  });
}

function shouldTryNextSearchRoute(err: unknown): boolean {
  if (isRetryableVersionError(err)) return true;
  return Boolean(
    axios.isAxiosError(err) && err.response && [400, 405].includes(err.response.status)
  );
}

export async function jiraSearch(
  client: AxiosInstance,
  jql: string,
  fields: string[],
  opts?: { startAt?: number; maxResults?: number }
) {
  const startAt = opts?.startAt ?? 0;
  const maxResults = Math.min(opts?.maxResults ?? 100, 100);
  const body = { jql, startAt, maxResults, fields };

  // Prefer POST /3/search first: it is supported on almost all Jira Cloud/Data Center
  // instances. Starting with GET /3/search/jql forces a failed round-trip on hosts
  // that do not expose that route, doubling latency for every paginated page.
  try {
    const { data } = await client.post("/3/search", body);
    return data as JiraSearchResponse;
  } catch (err) {
    if (!shouldTryNextSearchRoute(err)) throw err;
  }

  // Newer Jira Cloud path: GET /3/search/jql (CHANGE-2046).
  try {
    const { data } = await client.get("/3/search/jql", {
      params: {
        jql,
        startAt,
        maxResults,
        fields,
      },
    });
    return data as JiraSearchResponse;
  } catch (err) {
    if (!shouldTryNextSearchRoute(err)) throw err;
  }

  const { data } = await client.post("/2/search", body);
  return data as JiraSearchResponse;
}

export type JiraSearchResponse = {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
};

export type JiraIssue = {
  id: string;
  key: string;
  fields: Record<string, unknown>;
};

export async function jiraProjectList(client: AxiosInstance) {
  try {
    return await withVersionFallback(client, async (v) => {
      const { data } = await client.get(`/${v}/project/search`, { params: { maxResults: 50 } });
      return data as { values: { id: string; key: string; name: string }[] };
    });
  } catch (err) {
    if (!isRetryableVersionError(err)) throw err;
    const { data } = await client.get("/2/project");
    const values = Array.isArray(data) ? data : [];
    return { values: values.map((p: { id: string; key: string; name: string }) => ({ id: p.id, key: p.key, name: p.name })) };
  }
}

export async function jiraIssueWorklogs(client: AxiosInstance, issueId: string) {
  return withVersionFallback(client, async (v) => {
    const { data } = await client.get(`/${v}/issue/${issueId}/worklog`);
    return data as {
      worklogs: {
        id: string;
        author: { accountId: string; displayName?: string };
        started: string;
        timeSpentSeconds: number;
        comment?: unknown;
      }[];
    };
  });
}
