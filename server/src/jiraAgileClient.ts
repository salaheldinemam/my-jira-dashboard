import axios, { type AxiosInstance } from "axios";
import type { JiraClientConfig } from "./jiraClient.js";
import { axiosOutboundConfig } from "./outboundHttps.js";

export function createJiraAgileClient(config: JiraClientConfig): AxiosInstance {
  if (config.mode === "oauth") {
    return axios.create({
      baseURL: `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/agile/1.0`,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 60_000,
      ...axiosOutboundConfig(),
    });
  }
  const normalized = config.baseUrl.replace(/\/$/, "");
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  return axios.create({
    baseURL: `${normalized}/rest/agile/1.0`,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: 60_000,
    ...axiosOutboundConfig(),
  });
}

export type JiraBoard = {
  id: number;
  name: string;
  type?: string;
  location?: { projectKey?: string; projectId?: number };
};

export type JiraSprint = {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  originBoardId?: number;
};

export type AgileSprintOption = {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  boardId: number;
  boardName?: string;
  projectKeys: string[];
};

export async function jiraAgileBoardsForProject(
  client: AxiosInstance,
  projectKey: string
): Promise<JiraBoard[]> {
  const { data } = await client.get("/board", {
    params: { projectKeyOrId: projectKey, maxResults: 50 },
  });
  return (data.values ?? []) as JiraBoard[];
}

export async function jiraAgileBoardSprints(
  client: AxiosInstance,
  boardId: number,
  state = "active,future"
): Promise<JiraSprint[]> {
  const sprints: JiraSprint[] = [];
  let startAt = 0;
  const maxResults = 50;
  for (;;) {
    const { data } = await client.get(`/board/${boardId}/sprint`, {
      params: { state, startAt, maxResults },
    });
    const values = (data.values ?? []) as JiraSprint[];
    sprints.push(...values);
    if (data.isLast || values.length < maxResults) break;
    startAt += maxResults;
  }
  return sprints;
}

/** Active and future sprints across scrum boards for the given project keys. */
export async function jiraAgileOpenSprintsForProjects(
  client: AxiosInstance,
  projectKeys: string[]
): Promise<AgileSprintOption[]> {
  const byId = new Map<number, AgileSprintOption>();

  for (const key of projectKeys) {
    const boards = await jiraAgileBoardsForProject(client, key);
    for (const board of boards) {
      const sprints = await jiraAgileBoardSprints(client, board.id);
      for (const sprint of sprints) {
        if (sprint.state !== "active" && sprint.state !== "future") continue;
        const existing = byId.get(sprint.id);
        const projectKeysForSprint = existing
          ? [...new Set([...existing.projectKeys, key])]
          : [key];
        byId.set(sprint.id, {
          id: sprint.id,
          name: sprint.name,
          state: sprint.state,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          boardId: board.id,
          boardName: board.name,
          projectKeys: projectKeysForSprint,
        });
      }
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
