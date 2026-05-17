import { Link } from "react-router-dom";
import { useUiStore } from "../../store";

export function QuickActions() {
  const jiraBaseUrl = useUiStore((s) => s.jiraBaseUrl);
  const filterUrl = jiraBaseUrl
    ? `${jiraBaseUrl}/issues/?jql=assignee%20%3D%20currentUser()%20AND%20resolution%20%3D%20Unresolved`
    : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-medium text-slate-200 mb-3">Quick actions</h2>
      <div className="flex flex-wrap gap-2">
        {filterUrl && (
          <a
            href={filterUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            My open issues in Jira
          </a>
        )}
        {jiraBaseUrl && (
          <a
            href={`${jiraBaseUrl}/secure/CreateIssue!default.jspa`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
          >
            Create issue
          </a>
        )}
        <Link
          to="/workload"
          className="px-3 py-2 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          Team workload
        </Link>
        <Link
          to="/time"
          className="px-3 py-2 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          Time tracking
        </Link>
        <Link
          to="/testing"
          className="px-3 py-2 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          Testing board
        </Link>
      </div>
    </div>
  );
}
