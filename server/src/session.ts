import type { Session, SessionData } from "express-session";
import { decryptSecret, encryptSecret } from "./crypto.js";
import type { StatusMapping } from "./statusMapping.js";

/** `req.session` is a `Session` instance with `SessionData` fields (incl. `jira`). */
type AppSession = Session & SessionData;

export type SessionJira = NonNullable<SessionData["jira"]>;

export function setJiraSession(
  session: AppSession,
  secret: string,
  payload: { baseUrl: string; email: string; apiToken: string; statusMapping?: Partial<StatusMapping> | null }
) {
  const sm = payload.statusMapping;
  session.jira = {
    baseUrl: payload.baseUrl.replace(/\/$/, ""),
    email: payload.email.trim(),
    tokenEnc: encryptSecret(payload.apiToken, secret),
    statusMapping: sm
      ? (Object.fromEntries(
          Object.entries(sm).filter((e): e is [string, string[]] => Array.isArray(e[1]))
        ) as Record<string, string[]>)
      : undefined,
  };
}

export function clearJiraSession(session: AppSession) {
  session.jira = null;
}

export function getApiToken(session: AppSession, secret: string): string | null {
  const j = session.jira;
  if (!j?.tokenEnc) return null;
  try {
    return decryptSecret(j.tokenEnc, secret);
  } catch {
    return null;
  }
}
