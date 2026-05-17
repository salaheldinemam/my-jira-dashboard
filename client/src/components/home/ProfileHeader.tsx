import type { AuthMe } from "../../types";

type ProfileHeaderProps = {
  me: AuthMe | null;
  loading: boolean;
  avatarUrl?: string;
};

export function ProfileHeader({ me, loading, avatarUrl }: ProfileHeaderProps) {
  if (loading) {
    return <ProfileSkeleton />;
  }

  const name = me?.displayName ?? me?.email ?? "Jira user";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const imageUrl = avatarUrl ?? me?.avatarUrl;

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-6">
      <div className="flex items-start gap-4">
        <UserAvatar name={name} imageUrl={imageUrl} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-400">{greeting}</p>
          <h1 className="text-2xl font-semibold text-white mt-1 truncate">{name}</h1>
          {me?.email ? <p className="text-sm text-slate-500 mt-1 truncate">{me.email}</p> : null}
          {me?.baseUrl ? (
            <a
              href={me.baseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-3 text-sm text-sky-300 hover:text-sky-200"
            >
              Open Jira site
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 animate-pulse flex gap-4">
      <div className="w-14 h-14 rounded-full bg-slate-800 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-48 bg-slate-800 rounded" />
        <div className="h-6 w-32 bg-slate-800 rounded" />
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
        className="w-14 h-14 rounded-full border-2 border-slate-700 object-cover shrink-0 bg-slate-800"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className="w-14 h-14 rounded-full border-2 border-slate-700 shrink-0 bg-slate-800 flex items-center justify-center text-lg font-semibold text-sky-200"
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
