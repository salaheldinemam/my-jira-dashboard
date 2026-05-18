import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../api";
import { loadJiraConnection, saveJiraConnection } from "../jiraSettings";
import { useUiStore } from "../store";
import { ThemeSwitcher } from "./ThemeSwitcher";

const nav = [
  { to: "/", label: "Home" },
  { to: "/time", label: "Time" },
  { to: "/workload", label: "Workload" },
  { to: "/testing", label: "Testing" },
  { to: "/stories", label: "Stories" },
  { to: "/qr-lv3", label: "LV3 Tickets" },
  { to: "/settings", label: "Settings" },
];

export function Layout() {
  const setJiraBaseUrl = useUiStore((s) => s.setJiraBaseUrl);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api<{
          connected: boolean;
          baseUrl?: string;
          email?: string;
          authMode?: "oauth" | "basic";
          displayName?: string;
        }>("/api/auth/me");
        if (!alive) return;
        setDisplayName(me.connected ? (me.displayName ?? me.email ?? null) : null);
        if (me.connected && me.baseUrl && me.email) {
          setJiraBaseUrl(me.baseUrl);
          const saved = loadJiraConnection();
          if (!saved || saved.baseUrl !== me.baseUrl) {
            saveJiraConnection({
              baseUrl: me.baseUrl,
              email: me.email,
              authMode: me.authMode ?? "oauth",
              displayName: me.displayName,
            });
          }
        } else {
          setJiraBaseUrl(null);
          setDisplayName(null);
        }
      } catch {
        if (alive) {
          setJiraBaseUrl(null);
          setDisplayName(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [setJiraBaseUrl]);

  return (
    <div className="app-page">
      <header className="app-header">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
          <HeaderBrand displayName={displayName} />
          <div className="flex flex-wrap items-center gap-3">
            <ThemeSwitcher />
            <nav className="flex flex-wrap gap-1 text-sm">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md transition-colors ${
                      isActive
                        ? "bg-app-surface-muted text-app-text font-medium"
                        : "text-app-text-muted hover:text-app-text hover:bg-app-surface-muted/80"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function HeaderBrand({ displayName }: { displayName: string | null }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex items-center gap-2 font-semibold text-app-text tracking-tight shrink-0">
        <img src="/assets/logo.svg" alt="Jira Team Insights logo" className="h-6 w-6" />
        <span>Jira Team Insights</span>
      </div>
      {displayName ? (
        <span className="text-sm text-app-text-muted truncate max-w-[14rem] hidden sm:inline border-l border-app-border pl-3">
          {displayName}
        </span>
      ) : null}
    </div>
  );
}
