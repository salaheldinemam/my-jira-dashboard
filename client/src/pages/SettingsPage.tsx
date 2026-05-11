import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { JiraSettings, loadJiraSettings, saveJiraSettings } from "../jiraSettings";
import { useUiStore } from "../store";

type AuthResponse = {
  ok: boolean;
  normalizedBaseUrl: string;
};

export function SettingsPage() {
  const setJiraBaseUrl = useUiStore((s) => s.setJiraBaseUrl);
  const [form, setForm] = useState<JiraSettings>({
    baseUrl: "",
    email: "",
    apiToken: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = loadJiraSettings();
    if (!saved) return;
    setForm(saved);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api<AuthResponse>("/api/auth/jira", {
        method: "POST",
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          email: form.email,
          apiToken: form.apiToken,
        }),
      });
      const toStore = {
        ...form,
        baseUrl: res.normalizedBaseUrl,
      };
      saveJiraSettings(toStore);
      setForm(toStore);
      setJiraBaseUrl(res.normalizedBaseUrl);
      setSuccess("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-white mb-2">Settings</h1>
      <p className="text-slate-400 text-sm mb-6">
        Configure Jira credentials. These values are saved in your browser local storage.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <label className="block">
          <div className="mb-1 text-sm text-slate-300">JIRA_BASE_URL</div>
          <input
            required
            type="url"
            value={form.baseUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            placeholder="https://your-domain.atlassian.net"
          />
        </label>
        <label className="block">
          <div className="mb-1 text-sm text-slate-300">JIRA_EMAIL</div>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            placeholder="you@company.com"
          />
        </label>
        <label className="block">
          <div className="mb-1 text-sm text-slate-300">JIRA_API_TOKEN</div>
          <input
            required
            type="password"
            value={form.apiToken}
            onChange={(e) => setForm((prev) => ({ ...prev, apiToken: e.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
            placeholder="Enter Jira API token"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-sky-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-sky-500 transition-colors"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
        {error && <div className="text-sm text-rose-400">{error}</div>}
        {success && <div className="text-sm text-emerald-400">{success}</div>}
      </form>
    </div>
  );
}
