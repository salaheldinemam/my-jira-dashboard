import { Router } from "express";
import { z } from "zod";
import axios from "axios";
import { createJiraClient, jiraGetMyself } from "../jiraClient.js";
import { clearJiraSession, setJiraSession } from "../session.js";
import type { StatusMapping } from "../statusMapping.js";

const bodySchema = z.object({
  baseUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().min(1),
  statusMapping: z.record(z.array(z.string())).optional().nullable(),
});

export function authRouter(sessionSecret: string) {
  const r = Router();

  function normalizeBaseUrl(raw: string): string {
    const u = new URL(raw);
    // Jira Cloud should always use site origin only.
    if (u.hostname.endsWith(".atlassian.net")) return u.origin;
    // For self-hosted Jira, keep at most one context segment (if present).
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length <= 1) return `${u.origin}${parts.length ? `/${parts[0]}` : ""}`;
    return u.origin;
  }

  r.post("/jira", async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const { baseUrl, email, apiToken, statusMapping } = parsed.data;
    try {
      const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
      const client = createJiraClient({ baseUrl: normalizedBaseUrl, email, apiToken });
      const me = await jiraGetMyself(client);
      setJiraSession(req.session, sessionSecret, {
        baseUrl: normalizedBaseUrl,
        email,
        apiToken,
        statusMapping: statusMapping as Partial<StatusMapping> | null | undefined,
      });
      res.json({
        ok: true,
        normalizedBaseUrl,
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

  r.get("/me", (req, res) => {
    if (!req.session.jira) {
      res.status(401).json({ connected: false });
      return;
    }
    res.json({
      connected: true,
      baseUrl: req.session.jira.baseUrl,
      email: req.session.jira.email,
    });
  });

  return r;
}
