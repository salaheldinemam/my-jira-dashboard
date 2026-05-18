import { useUiStore } from "../../store";
import type { AuthMe } from "../../types";

type ProfileHeaderProps = {
  me: AuthMe | null;
  loading: boolean;
  avatarUrl?: string;
};

export function ProfileHeader({ me, loading, avatarUrl }: ProfileHeaderProps) {
  const jiraBaseUrl = useUiStore((s) => s.jiraBaseUrl);

  if (loading) {
    return <ProfileSkeleton />;
  }

  const name = me?.displayName ?? me?.email ?? "Jira user";
  const openIssuesUrl = jiraBaseUrl
    ? `${jiraBaseUrl}/issues/?jql=assignee%20%3D%20currentUser()%20AND%20resolution%20%3D%20Unresolved`
    : null;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const imageUrl = avatarUrl ?? me?.avatarUrl;

  return (
    <div className="app-card p-6">
      <div className="flex items-start gap-4">
        <UserAvatar name={name} imageUrl={imageUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-app-text-muted">{greeting}</p>
          <h1 className="text-2xl font-semibold text-app-text mt-1 truncate">{name}</h1>
          {me?.email ? <p className="text-sm text-app-text-muted mt-1 truncate">{me.email}</p> : null}
          <div className="flex flex-wrap gap-2 mt-3">
                      {me?.baseUrl ? (
                          <a
                              href={me.baseUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 self-center px-1"
                          >
                              Open Jira site
                          </a>
                      ) : null}

                     {openIssuesUrl ? (
                          <a href={openIssuesUrl} target="_blank" rel="noreferrer" className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 self-center px-1">
                         My open issues in JIRA
                            </a>
                      ) : null}


                      {jiraBaseUrl ? (
              <a
                href={`${jiraBaseUrl}/secure/CreateIssue!default.jspa`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 self-center px-1"
              >
                Create issue
              </a>
            ) : null}
            
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="app-card p-6 animate-pulse flex gap-4">
      <div className="w-14 h-14 rounded-full bg-app-surface-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-app-surface-muted rounded" />
        <div className="h-6 w-32 bg-app-surface-muted rounded" />
      </div>
    </div>
  );
}

function UserAvatar({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const initials = initialsFromName(name);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="w-14 h-14 rounded-full border-2 border-app-border object-cover shrink-0 bg-app-surface-muted"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className="w-14 h-14 rounded-full border-2 border-app-border shrink-0 bg-app-surface-muted flex items-center justify-center text-lg font-semibold text-sky-600 dark:text-sky-300"
      aria-hidden
    >
      {initials}
    </div>
  );
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
