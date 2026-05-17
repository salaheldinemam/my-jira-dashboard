import type { Session, SessionData } from "express-session";
import { decryptSecret, encryptSecret } from "./crypto.js";
import type { StatusMapping } from "./statusMapping.js";

export type AppSession = Session & SessionData;

export type SessionJira = NonNullable<SessionData["jira"]>;

export function sessionHasJira(session: AppSession): boolean {
  return Boolean(session.jira?.baseUrl);
}

export function getSessionAccountId(session: AppSession): string | null {
  return session.jira?.accountId ?? null;
}

export function setJiraBasicSession(
  session: AppSession,
  secret: string,
  payload: {
    baseUrl: string;
    email: string;
    apiToken: string;
    displayName?: string;
    accountId?: string;
    avatarUrl?: string;
    statusMapping?: Partial<StatusMapping> | null;
  }
) {
  const sm = payload.statusMapping;
  session.jira = {
    authMode: "basic",
    baseUrl: payload.baseUrl.replace(/\/$/, ""),
    email: payload.email.trim(),
    displayName: payload.displayName,
    accountId: payload.accountId,
    avatarUrl: payload.avatarUrl,
    tokenEnc: encryptSecret(payload.apiToken, secret),
    statusMapping: sm
      ? (Object.fromEntries(
          Object.entries(sm).filter((e): e is [string, string[]] => Array.isArray(e[1]))
        ) as Record<string, string[]>)
      : undefined,
  };
}

export function setJiraOAuthSession(
  session: AppSession,
  secret: string,
  payload: {
    baseUrl: string;
    cloudId: string;
    email: string;
    displayName?: string;
    accountId?: string;
    avatarUrl?: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    statusMapping?: Partial<StatusMapping> | null;
  }
) {
  const sm = payload.statusMapping;
  session.jira = {
    authMode: "oauth",
    baseUrl: payload.baseUrl.replace(/\/$/, ""),
    cloudId: payload.cloudId,
    email: payload.email.trim(),
    displayName: payload.displayName,
    accountId: payload.accountId,
    avatarUrl: payload.avatarUrl,
    tokenEnc: encryptSecret(payload.accessToken, secret),
    refreshTokenEnc: payload.refreshToken ? encryptSecret(payload.refreshToken, secret) : undefined,
    expiresAt: Date.now() + payload.expiresIn * 1000,
    statusMapping: sm
      ? (Object.fromEntries(
          Object.entries(sm).filter((e): e is [string, string[]] => Array.isArray(e[1]))
        ) as Record<string, string[]>)
      : undefined,
  };
}

export function setOAuthTokens(
  session: AppSession,
  secret: string,
  payload: { accessToken: string; refreshToken?: string; expiresIn: number }
) {
  const jira = session.jira;
  if (!jira || jira.authMode !== "oauth") return;
  jira.tokenEnc = encryptSecret(payload.accessToken, secret);
  if (payload.refreshToken) {
    jira.refreshTokenEnc = encryptSecret(payload.refreshToken, secret);
  }
  jira.expiresAt = Date.now() + payload.expiresIn * 1000;
}

export function clearJiraSession(session: AppSession) {
  session.jira = null;
  session.atlassianOAuthState = undefined;
}

export function getAccessToken(session: AppSession, secret: string): string | null {
  const j = session.jira;
  if (!j?.tokenEnc) return null;
  try {
    return decryptSecret(j.tokenEnc, secret);
  } catch {
    return null;
  }
}

export function getRefreshToken(session: AppSession, secret: string): string | null {
  const j = session.jira;
  if (!j?.refreshTokenEnc) return null;
  try {
    return decryptSecret(j.refreshTokenEnc, secret);
  } catch {
    return null;
  }
}

/** @deprecated Use getAccessToken */
export function getApiToken(session: AppSession, secret: string): string | null {
  return getAccessToken(session, secret);
}

/** @deprecated Use setJiraBasicSession */
export function setJiraSession(
  session: AppSession,
  secret: string,
  payload: { baseUrl: string; email: string; apiToken: string; statusMapping?: Partial<StatusMapping> | null }
) {
  setJiraBasicSession(session, secret, payload);
}
