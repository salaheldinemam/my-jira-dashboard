import type { Request } from "express";
import {
  getAtlassianOAuthConfig,
  refreshAccessToken,
  type AtlassianOAuthConfig,
} from "./atlassianOAuth.js";
import { createJiraClient, type JiraClientConfig } from "./jiraClient.js";
import {
  getAccessToken,
  getRefreshToken,
  sessionHasJira,
  setOAuthTokens,
  type AppSession,
} from "./session.js";

const REFRESH_BUFFER_MS = 60_000;

export async function resolveJiraClientConfig(
  session: AppSession,
  sessionSecret: string
): Promise<JiraClientConfig | null> {
  if (!sessionHasJira(session)) return null;
  const jira = session.jira!;

  if (jira.authMode === "basic") {
    const apiToken = getAccessToken(session, sessionSecret);
    if (!apiToken || !jira.email) return null;
    return { mode: "basic", baseUrl: jira.baseUrl, email: jira.email, apiToken };
  }

  const oauthConfig = getAtlassianOAuthConfig();
  if (!oauthConfig || !jira.cloudId) return null;

  let accessToken = getAccessToken(session, sessionSecret);
  if (!accessToken) return null;

  const expiresAt = jira.expiresAt ?? 0;
  if (expiresAt - Date.now() < REFRESH_BUFFER_MS) {
    const refreshToken = getRefreshToken(session, sessionSecret);
    if (!refreshToken) return null;
    try {
      accessToken = await refreshOAuthTokens(session, sessionSecret, oauthConfig, refreshToken);
    } catch {
      return null;
    }
  }

  return { mode: "oauth", cloudId: jira.cloudId, accessToken, baseUrl: jira.baseUrl };
}

export async function resolveJiraClient(req: Request, sessionSecret: string) {
  const cfg = await resolveJiraClientConfig(req.session, sessionSecret);
  if (!cfg) return null;
  return createJiraClient(cfg);
}

async function refreshOAuthTokens(
  session: AppSession,
  sessionSecret: string,
  oauthConfig: AtlassianOAuthConfig,
  refreshToken: string
): Promise<string> {
  const tokens = await refreshAccessToken(oauthConfig, refreshToken);
  setOAuthTokens(session, sessionSecret, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
  });
  return tokens.access_token;
}
