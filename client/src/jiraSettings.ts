export const JIRA_SETTINGS_STORAGE_KEY = "jira-insights-settings";

export type JiraConnection = {
  baseUrl: string;
  email: string;
  authMode: "oauth" | "basic";
  displayName?: string;
};

function normalize(settings: JiraConnection): JiraConnection {
  return {
    baseUrl: settings.baseUrl.trim(),
    email: settings.email.trim(),
    authMode: settings.authMode,
    displayName: settings.displayName?.trim(),
  };
}

export function hasJiraConnection(settings: JiraConnection | null | undefined): settings is JiraConnection {
  return Boolean(settings?.baseUrl && settings.email);
}

export function loadJiraConnection(): JiraConnection | null {
  try {
    const raw = localStorage.getItem(JIRA_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JiraConnection>;
    if (!parsed || typeof parsed !== "object") return null;
    const settings: JiraConnection = {
      baseUrl: String(parsed.baseUrl ?? ""),
      email: String(parsed.email ?? ""),
      authMode: parsed.authMode === "basic" ? "basic" : "oauth",
      displayName: parsed.displayName ? String(parsed.displayName) : undefined,
    };
    return hasJiraConnection(settings) ? normalize(settings) : null;
  } catch {
    return null;
  }
}

export function saveJiraConnection(settings: JiraConnection) {
  localStorage.setItem(JIRA_SETTINGS_STORAGE_KEY, JSON.stringify(normalize(settings)));
}

export function clearJiraConnection() {
  localStorage.removeItem(JIRA_SETTINGS_STORAGE_KEY);
}

/** @deprecated Use loadJiraConnection */
export function loadJiraSettings() {
  return loadJiraConnection();
}

/** @deprecated Use hasJiraConnection */
export function hasJiraSettings(settings: JiraConnection | null | undefined) {
  return hasJiraConnection(settings);
}

/** @deprecated Use saveJiraConnection */
export function saveJiraSettings(settings: JiraConnection) {
  saveJiraConnection(settings);
}
