import { Router } from "express";
import { z } from "zod";
import axios from "axios";
import {
  buildAuthorizeUrl,
  createOAuthState,
  exchangeCodeForTokens,
  getAccessibleResources,
  getAtlassianOAuthConfig,
  isOAuthConfigured,
} from "../atlassianOAuth.js";
import { createJiraClient, jiraGetMyself, pickAvatarUrl } from "../jiraClient.js";
import { resolveJiraClientConfig } from "../jiraAuth.js";
import { persistSession } from "../persistSession.js";
import { clearJiraSession, setJiraBasicSession, setJiraOAuthSession } from "../session.js";
import type { StatusMapping } from "../statusMapping.js";

const bodySchema = z.object({
  baseUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().min(1),
  statusMapping: z.record(z.array(z.string())).optional().nullable(),
});

function clientOrigin(): string {
  return process.env.CLIENT_ORIGIN?.trim() || "http://localhost:5173";
}

export function authRouter(sessionSecret: string) {
  const r = Router();

  function normalizeBaseUrl(raw: string): string {
    const u = new URL(raw);
    if (u.hostname.endsWith(".atlassian.net")) return u.origin;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length <= 1) return `${u.origin}${parts.length ? `/${parts[0]}` : ""}`;
    return u.origin;
  }

  r.get("/atlassian", (req, res) => {
    const config = getAtlassianOAuthConfig();
    if (!config) {
      res.status(503).json({
        error: "Atlassian OAuth is not configured. Set ATLASSIAN_CLIENT_ID, ATLASSIAN_CLIENT_SECRET, and ATLASSIAN_REDIRECT_URI.",
      });
      return;
    }
    const state = createOAuthState();
    req.session.atlassianOAuthState = state;
    req.session.save((err) => {
      if (err) {
        res.status(500).json({ error: "Failed to start OAuth flow" });
        return;
      }
      res.redirect(buildAuthorizeUrl(config, state));
    });
  });

  r.get("/atlassian/callback", async (req, res) => {
    const config = getAtlassianOAuthConfig();
    if (!config) {
      res.redirect(`${clientOrigin()}/settings?error=oauth_not_configured`);
      return;
    }

    const error = typeof req.query.error === "string" ? req.query.error : null;
    if (error) {
      res.redirect(`${clientOrigin()}/settings?error=${encodeURIComponent(error)}`);
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const expectedState = req.session.atlassianOAuthState;
    req.session.atlassianOAuthState = undefined;

    if (!code || !state || !expectedState || state !== expectedState) {
      res.redirect(`${clientOrigin()}/settings?error=invalid_oauth_state`);
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens(config, code);
      const resources = await getAccessibleResources(tokens.access_token);
      const site = resources[0];
      if (!site) {
        res.redirect(`${clientOrigin()}/settings?error=no_accessible_sites`);
        return;
      }

      const baseUrl = normalizeBaseUrl(site.url);
      const client = createJiraClient({
        mode: "oauth",
        cloudId: site.id,
        accessToken: tokens.access_token,
        baseUrl,
      });
      const me = await jiraGetMyself(client);

      setJiraOAuthSession(req.session, sessionSecret, {
        baseUrl,
        cloudId: site.id,
        email: me.emailAddress ?? "connected@atlassian",
        displayName: me.displayName,
        accountId: me.accountId,
        avatarUrl: pickAvatarUrl(me.avatarUrls),
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
      });

      req.session.save((saveErr) => {
        if (saveErr) {
          res.redirect(`${clientOrigin()}/settings?error=session_save_failed`);
          return;
        }
        res.redirect(`${clientOrigin()}/settings?connected=1`);
      });
    } catch (e: unknown) {
      console.error("OAuth callback failed:", e);
      res.redirect(`${clientOrigin()}/settings?error=oauth_callback_failed`);
    }
  });

  r.post("/jira", async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const { baseUrl, email, apiToken, statusMapping } = parsed.data;
    try {
      const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
      const client = createJiraClient({ mode: "basic", baseUrl: normalizedBaseUrl, email, apiToken });
      const me = await jiraGetMyself(client);
      setJiraBasicSession(req.session, sessionSecret, {
        baseUrl: normalizedBaseUrl,
        email,
        apiToken,
        displayName: me.displayName,
        accountId: me.accountId,
        avatarUrl: pickAvatarUrl(me.avatarUrls),
        statusMapping: statusMapping as Partial<StatusMapping> | null | undefined,
      });
      res.json({
        ok: true,
        normalizedBaseUrl,
        authMode: "basic" as const,
        user: { displayName: me.displayName, accountId: me.accountId, email: me.emailAddress ?? email },
      });
    } catch (e: unknown) {
      let msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Jira connection failed";
      if (axios.isAxiosError(e)) {
        const status = e.response?.status;
        const data = e.response?.data;
        if (status) msg = `Jira auth failed (${status})`;
        if (data && typeof data === "object") {
          const d = data as { errorMessages?: string[]; errors?: Record<string, string> };
          const apiMsg = d.errorMessages?.join("; ") || Object.values(d.errors ?? {}).join("; ");
          if (apiMsg) msg += `: ${apiMsg}`;
        }
      }
      res.status(401).json({ error: msg });
    }
  });

  r.post("/logout", (req, res) => {
    clearJiraSession(req.session);
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  r.get("/me", async (req, res) => {
    const jira = req.session.jira;
    if (!jira?.baseUrl) {
      res.json({ connected: false, oauthAvailable: isOAuthConfigured() });
      return;
    }

    if (jira.authMode === "oauth") {
      const { config, sessionTouched } = await resolveJiraClientConfig(req.session, sessionSecret);
      if (sessionTouched) {
        try {
          await persistSession(req);
        } catch (err) {
          console.error("Failed to persist session on /me:", err);
        }
      }
      if (!config) {
        res.json({ connected: false, oauthAvailable: isOAuthConfigured() });
        return;
      }
    }

    res.json({
      connected: true,
      authMode: jira.authMode,
      baseUrl: jira.baseUrl,
      email: jira.email,
      displayName: jira.displayName,
      accountId: jira.accountId,
      avatarUrl: jira.avatarUrl,
      oauthAvailable: isOAuthConfigured(),
    });
  });

  return r;
}
