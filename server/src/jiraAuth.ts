import type { Request } from "express";
import {
  getAtlassianOAuthConfig,
  refreshAccessToken,
  type AtlassianOAuthConfig,
} from "./atlassianOAuth.js";
import { createJiraClient, type JiraClientConfig } from "./jiraClient.js";
import { isTlsCertificateError, TLS_HELP_MESSAGE } from "./outboundHttps.js";
import { persistSession } from "./persistSession.js";
import {
  getAccessToken,
  getRefreshToken,
  sessionHasJira,
  setOAuthTokens,
  type AppSession,
} from "./session.js";

/** Refresh OAuth access tokens this many ms before they expire. */
const REFRESH_BUFFER_MS = 5 * 60_000;

export type ResolveJiraResult = {
  config: JiraClientConfig | null;
  sessionTouched: boolean;
};

export async function resolveJiraClientConfig(
  session: AppSession,
  sessionSecret: string
): Promise<ResolveJiraResult> {
  if (!sessionHasJira(session)) return { config: null, sessionTouched: false };
  const jira = session.jira!;

  if (jira.authMode === "basic") {
    const apiToken = getAccessToken(session, sessionSecret);
    if (!apiToken || !jira.email) return { config: null, sessionTouched: false };
    return { config: { mode: "basic", baseUrl: jira.baseUrl, email: jira.email, apiToken }, sessionTouched: false };
  }

  const oauthConfig = getAtlassianOAuthConfig();
  if (!oauthConfig || !jira.cloudId) return { config: null, sessionTouched: false };

  let accessToken = getAccessToken(session, sessionSecret);
  if (!accessToken) return { config: null, sessionTouched: false };

  const expiresAt = jira.expiresAt ?? 0;
  const msUntilExpiry = expiresAt - Date.now();
  let sessionTouched = false;

  if (msUntilExpiry < REFRESH_BUFFER_MS) {
    const refreshToken = getRefreshToken(session, sessionSecret);
    if (!refreshToken) {
      if (msUntilExpiry <= 0) return { config: null, sessionTouched: false };
    } else {
      try {
        accessToken = await refreshOAuthTokens(session, sessionSecret, oauthConfig, refreshToken);
        sessionTouched = true;
      } catch (err) {
        if (isTlsCertificateError(err)) {
          console.error(`OAuth token refresh failed: ${TLS_HELP_MESSAGE}`);
        } else {
          console.error("OAuth token refresh failed:", err);
        }
        if (msUntilExpiry <= 0) return { config: null, sessionTouched: false };
      }
    }
  }

  return {
    config: { mode: "oauth", cloudId: jira.cloudId, accessToken, baseUrl: jira.baseUrl },
    sessionTouched,
  };
}

export async function resolveJiraClient(req: Request, sessionSecret: string) {
  const { config, sessionTouched } = await resolveJiraClientConfig(req.session, sessionSecret);
  if (sessionTouched) {
    try {
      await persistSession(req);
    } catch (err) {
      console.error("Failed to persist session after OAuth refresh:", err);
    }
  }
  if (!config) return null;
  return createJiraClient(config);
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
