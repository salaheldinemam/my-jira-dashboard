import axios, { type AxiosInstance } from "axios";
import { axiosOutboundConfig } from "./outboundHttps.js";

export type JiraClientConfig =
  | { mode: "basic"; baseUrl: string; email: string; apiToken: string }
  | { mode: "oauth"; cloudId: string; accessToken: string; baseUrl: string };

/** @deprecated Use JiraClientConfig */
export type JiraCredentials = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

export function createJiraClient(creds: JiraClientConfig | JiraCredentials): AxiosInstance {
  if ("mode" in creds) {
    if (creds.mode === "oauth") {
      return axios.create({
        baseURL: `https://api.atlassian.com/ex/jira/${creds.cloudId}/rest/api`,
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 60_000,
        ...axiosOutboundConfig(),
      });
    }
    return createBasicJiraClient(creds.baseUrl, creds.email, creds.apiToken);
  }
  return createBasicJiraClient(creds.baseUrl, creds.email, creds.apiToken);
}

function createBasicJiraClient(baseUrl: string, email: string, apiToken: string): AxiosInstance {
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
  const normalized = baseUrl.replace(/\/$/, "");
  return axios.create({
    baseURL: `${normalized}/rest/api`,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: 60_000,
    ...axiosOutboundConfig(),
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

export type JiraMyself = {
  accountId: string;
  displayName?: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
};

export function pickAvatarUrl(avatarUrls?: Record<string, string>): string | undefined {
  if (!avatarUrls) return undefined;
  return (
    avatarUrls["48x48"] ??
    avatarUrls["32x32"] ??
    avatarUrls["24x24"] ??
    avatarUrls["16x16"] ??
    Object.values(avatarUrls).find((u) => typeof u === "string" && u.length > 0)
  );
}

export async function jiraGetMyself(client: AxiosInstance): Promise<JiraMyself> {
  return withVersionFallback(client, async (v) => {
    const { data } = await client.get(`/${v}/myself`);
    return data as JiraMyself;
  });
}

function shouldTryNextSearchRoute(err: unknown): boolean {
  if (isRetryableVersionError(err)) return true;
  return Boolean(
    axios.isAxiosError(err) && err.response && [400, 405].includes(err.response.status)
  );
}

/** Newer Jira Cloud search (token pagination). */
export type JiraSearchJqlResponse = {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
};

export async function jiraSearchJql(
  client: AxiosInstance,
  jql: string,
  fields: string[],
  opts?: { maxResults?: number; nextPageToken?: string }
): Promise<JiraSearchJqlResponse> {
  const maxResults = Math.min(opts?.maxResults ?? 100, 100);
  const body: Record<string, unknown> = { jql, maxResults, fields };
  if (opts?.nextPageToken) body.nextPageToken = opts.nextPageToken;

  try {
    const { data } = await client.post("/3/search/jql", body);
    return data as JiraSearchJqlResponse;
  } catch (err) {
    if (!shouldTryNextSearchRoute(err)) throw err;
  }

  const { data } = await client.get("/3/search/jql", {
    params: {
      jql,
      maxResults,
      fields,
      ...(opts?.nextPageToken ? { nextPageToken: opts.nextPageToken } : {}),
    },
  });
  return data as JiraSearchJqlResponse;
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

  try {
    const { data } = await client.post("/3/search", body);
    return data as JiraSearchResponse;
  } catch (err) {
    if (!shouldTryNextSearchRoute(err)) throw err;
  }

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

export type JiraWorklog = {
  id: string;
  author: { accountId: string; displayName?: string };
  started: string;
  timeSpentSeconds: number;
  comment?: unknown;
};

export async function jiraIssueWorklogs(
  client: AxiosInstance,
  issueId: string,
  opts?: { startedAfter?: number; startedBefore?: number }
) {
  return withVersionFallback(client, async (v) => {
    const all: JiraWorklog[] = [];
    let startAt = 0;
    const maxResults = 100;
    for (;;) {
      const params: Record<string, number> = { startAt, maxResults };
      if (opts?.startedAfter != null) params.startedAfter = opts.startedAfter;
      if (opts?.startedBefore != null) params.startedBefore = opts.startedBefore;
      const { data } = await client.get(`/${v}/issue/${issueId}/worklog`, { params });
      const page = (data as { worklogs?: JiraWorklog[]; total?: number }).worklogs ?? [];
      all.push(...page);
      const total = (data as { total?: number }).total ?? page.length;
      if (page.length === 0 || startAt + page.length >= total) break;
      startAt += page.length;
    }
    return { worklogs: all };
  });
}
