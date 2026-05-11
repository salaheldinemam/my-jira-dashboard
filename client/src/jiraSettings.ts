export const JIRA_SETTINGS_STORAGE_KEY = "jira-insights-settings";

export type JiraSettings = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

function normalize(settings: JiraSettings): JiraSettings {
  return {
    baseUrl: settings.baseUrl.trim(),
    email: settings.email.trim(),
    apiToken: settings.apiToken.trim(),
  };
}

export function hasJiraSettings(settings: JiraSettings | null | undefined): settings is JiraSettings {
  return Boolean(settings?.baseUrl && settings.email && settings.apiToken);
}

export function loadJiraSettings(): JiraSettings | null {
  try {
    const raw = localStorage.getItem(JIRA_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JiraSettings>;
    if (!parsed || typeof parsed !== "object") return null;
    const settings: JiraSettings = {
      baseUrl: String(parsed.baseUrl ?? ""),
      email: String(parsed.email ?? ""),
      apiToken: String(parsed.apiToken ?? ""),
    };
    return hasJiraSettings(settings) ? normalize(settings) : null;
  } catch {
    return null;
  }
}

export function saveJiraSettings(settings: JiraSettings) {
  localStorage.setItem(JIRA_SETTINGS_STORAGE_KEY, JSON.stringify(normalize(settings)));
}
