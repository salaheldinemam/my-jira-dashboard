import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { clearJiraConnection, JiraConnection, loadJiraConnection, saveJiraConnection } from "../jiraSettings";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { useUiStore } from "../store";

type AuthMeResponse = {
  connected: boolean;
  authMode?: "oauth" | "basic";
  baseUrl?: string;
  email?: string;
  displayName?: string;
  oauthAvailable?: boolean;
};

type BasicAuthResponse = {
  ok: boolean;
  normalizedBaseUrl: string;
  authMode: "basic";
  user: { displayName?: string; accountId: string; email: string };
};

const OAUTH_ERRORS: Record<string, string> = {
  oauth_not_configured: "Atlassian OAuth is not configured on the server.",
  invalid_oauth_state: "OAuth state mismatch. Please try signing in again.",
  no_accessible_sites: "No Jira sites were returned for your account.",
  oauth_callback_failed: "OAuth sign-in failed. Please try again.",
  access_denied: "You declined access. Sign in again when ready.",
};

export function SettingsPage() {
  const setJiraBaseUrl = useUiStore((s) => s.setJiraBaseUrl);
  const [searchParams, setSearchParams] = useSearchParams();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [basicForm, setBasicForm] = useState({ baseUrl: "", email: "", apiToken: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(OAUTH_ERRORS[oauthError] ?? `Sign-in failed (${oauthError}).`);
      setSearchParams({}, { replace: true });
    }
    if (searchParams.get("connected") === "1") {
      setSuccess("Connected to Jira via Atlassian.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const status = await api<AuthMeResponse>("/api/auth/me");
        if (!alive) return;
        setMe(status);
        if (status.connected && status.baseUrl && status.email) {
          const conn: JiraConnection = {
            baseUrl: status.baseUrl,
            email: status.email,
            authMode: status.authMode ?? "oauth",
            displayName: status.displayName,
          };
          saveJiraConnection(conn);
          setJiraBaseUrl(status.baseUrl);
        }
        const saved = loadJiraConnection();
        if (saved) setBasicForm((prev) => ({ ...prev, baseUrl: saved.baseUrl, email: saved.email }));
      } catch {
        if (alive) setMe({ connected: false, oauthAvailable: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [setJiraBaseUrl]);

  function connectWithAtlassian() {
    window.location.href = "/api/auth/atlassian";
  }

  async function onBasicSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api<BasicAuthResponse>("/api/auth/jira", {
        method: "POST",
        body: JSON.stringify(basicForm),
      });
      const conn: JiraConnection = {
        baseUrl: res.normalizedBaseUrl,
        email: res.user.email,
        authMode: "basic",
        displayName: res.user.displayName,
      };
      saveJiraConnection(conn);
      setJiraBaseUrl(res.normalizedBaseUrl);
      setMe({ connected: true, ...conn, oauthAvailable: me?.oauthAvailable });
      setSuccess("Connected with API token.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/auth/logout", { method: "POST" });
      clearJiraConnection();
      setMe({ connected: false, oauthAvailable: me?.oauthAvailable });
      setJiraBaseUrl(null);
      setSuccess("Disconnected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-slate-600 dark:text-slate-400">Loading settings…</div>;
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Settings</h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
        Sign in with your Atlassian account to access Jira. Your session is stored securely on the server.
      </p>

      <section className="app-card p-5 mb-6">
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">Appearance</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Choose light, dark, or match your system setting.</p>
        <ThemeSwitcher />
      </section>

      {me?.connected ? (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/30 p-5 space-y-4">
          <div className="text-emerald-600 dark:text-emerald-400 font-medium">Connected to Jira</div>
          <dl className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
            <div>
              <dt className="text-slate-500">Site</dt>
              <dd>{me.baseUrl}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Account</dt>
              <dd>{me.displayName ?? me.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Auth</dt>
              <dd>{me.authMode === "oauth" ? "Atlassian OAuth" : "API token"}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={disconnect}
            disabled={saving}
            className="rounded-md border border-slate-400 dark:border-slate-600 px-4 py-2 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-app-surface-muted disabled:opacity-50 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="app-card p-5 space-y-4">
          {me?.oauthAvailable !== false ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                You will be redirected to Atlassian to approve access to your Jira Cloud site.
              </p>
              <button
                type="button"
                onClick={connectWithAtlassian}
                className="w-full rounded-md bg-[#0052CC] px-4 py-2.5 text-white font-medium hover:bg-[#0065FF] transition-colors"
              >
                Sign in with Atlassian
              </button>
            </>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              OAuth is not configured. Ask your admin to set ATLASSIAN_CLIENT_ID, ATLASSIAN_CLIENT_SECRET, and
              ATLASSIAN_REDIRECT_URI, or use the API token option below.
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-800 dark:text-slate-200 underline"
          >
            {showAdvanced ? "Hide" : "Use API token instead (advanced)"}
          </button>

          {showAdvanced && (
            <form onSubmit={onBasicSubmit} className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="block">
                <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">Jira site URL</div>
                <input
                  required
                  type="url"
                  value={basicForm.baseUrl}
                  onChange={(e) => setBasicForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                  placeholder="https://your-domain.atlassian.net"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">Email</div>
                <input
                  required
                  type="email"
                  value={basicForm.email}
                  onChange={(e) => setBasicForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-sm text-slate-700 dark:text-slate-300">API token</div>
                <input
                  required
                  type="password"
                  value={basicForm.apiToken}
                  onChange={(e) => setBasicForm((prev) => ({ ...prev, apiToken: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-sky-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-sky-500 transition-colors"
              >
                {saving ? "Connecting…" : "Connect with API token"}
              </button>
            </form>
          )}
        </div>
      )}

      {error && <div className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</div>}
      {success && <div className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">{success}</div>}
    </div>
  );
}
