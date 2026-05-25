import axios, { type AxiosInstance } from "axios";
import type { JiraClientConfig } from "./jiraClient.js";
import { createJiraClient } from "./jiraClient.js";
import { fetchAllIssuesForJql } from "./fetchAllIssues.js";
import {
  createJiraAgileClient,
  jiraAgileOpenSprintsForProjects,
  type AgileSprintOption,
} from "./jiraAgileClient.js";

type SprintFieldValue = {
  id?: number;
  name?: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  boardId?: number;
};

function projectJqlPrefix(projectKeys: string[]): string {
  if (projectKeys.length === 0) return "";
  return `project in (${projectKeys.map((k) => `"${k}"`).join(", ")}) AND `;
}

function normalizeSprintState(state: string | undefined): string {
  if (!state) return "active";
  const s = state.toLowerCase();
  if (s === "active" || s === "future" || s === "closed") return s;
  return s;
}

function isOpenSprintState(state: string | undefined): boolean {
  const s = normalizeSprintState(state);
  return s === "active" || s === "future";
}

function parseSprintFieldValues(raw: unknown): SprintFieldValue[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x) => x && typeof x === "object") as SprintFieldValue[];
  }
  if (typeof raw === "object") return [raw as SprintFieldValue];
  return [];
}

async function findSprintFieldId(client: AxiosInstance): Promise<string | null> {
  try {
    const { data } = await client.get("/3/field");
    const fields = data as { id: string; name: string; schema?: { custom?: string } }[];
    const sprint = fields.find(
      (f) =>
        f.name === "Sprint" ||
        f.schema?.custom === "com.pyxis.greenhopper.jira:gh-sprint"
    );
    return sprint?.id ?? null;
  } catch {
    try {
      const { data } = await client.get("/2/field");
      const fields = data as { id: string; name: string; schema?: { custom?: string } }[];
      const sprint = fields.find(
        (f) =>
          f.name === "Sprint" ||
          f.schema?.custom === "com.pyxis.greenhopper.jira:gh-sprint"
      );
      return sprint?.id ?? null;
    } catch {
      return null;
    }
  }
}

/** List open sprints by scanning issues with `sprint in openSprints()` (no Agile REST). */
async function jiraOpenSprintsViaJql(
  client: AxiosInstance,
  projectKeys: string[]
): Promise<AgileSprintOption[]> {
  const sprintFieldId = await findSprintFieldId(client);
  if (!sprintFieldId) {
    throw new Error("Could not find Sprint field on this Jira site");
  }

  const jql = `${projectJqlPrefix(projectKeys)}sprint in openSprints() ORDER BY updated DESC`;
  const issues = await fetchAllIssuesForJql(client, jql, 500, [
    "summary",
    "status",
    "project",
    sprintFieldId,
  ]);

  const byId = new Map<number, AgileSprintOption>();

  for (const issue of issues) {
    const projectKey =
      typeof issue.fields.project === "object" &&
      issue.fields.project &&
      "key" in issue.fields.project
        ? String((issue.fields.project as { key: string }).key)
        : projectKeys[0];

    for (const sprint of parseSprintFieldValues(issue.fields[sprintFieldId])) {
      if (!sprint.id || !sprint.name) continue;
      if (!isOpenSprintState(sprint.state)) continue;

      const state = normalizeSprintState(sprint.state);
      const existing = byId.get(sprint.id);
      const keys = existing
        ? [...new Set([...existing.projectKeys, projectKey])]
        : [projectKey];

      byId.set(sprint.id, {
        id: sprint.id,
        name: sprint.name,
        state,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        boardId: sprint.boardId ?? 0,
        projectKeys: keys.filter(Boolean),
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isAgileAuthError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  return status === 401 || status === 403;
}

/**
 * Load active/future sprints: prefer Agile REST; fall back to JQL if boards API is unauthorized.
 */
export async function loadOpenSprints(
  config: JiraClientConfig,
  projectKeys: string[]
): Promise<{ sprints: AgileSprintOption[]; source: "agile" | "jql" }> {
  const agile = createJiraAgileClient(config);
  try {
    const sprints = await jiraAgileOpenSprintsForProjects(agile, projectKeys);
    return { sprints, source: "agile" };
  } catch (err) {
    if (!isAgileAuthError(err)) throw err;
    console.warn(
      "Agile REST sprint list unauthorized; falling back to JQL openSprints()",
      axios.isAxiosError(err) ? err.response?.status : err
    );
    const client = createJiraClient(config);
    const sprints = await jiraOpenSprintsViaJql(client, projectKeys);
    return { sprints, source: "jql" };
  }
}

export type { AgileSprintOption };
