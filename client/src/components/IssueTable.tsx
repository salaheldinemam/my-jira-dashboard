import { JiraIssueLink } from "./JiraIssueLink";
import type { IssueRow } from "../types";

type Column = "status" | "type" | "priority" | "duedate" | "updated" | "project" | "assignee";

type IssueTableProps = {
  issues: IssueRow[];
  columns?: Column[];
  emptyMessage?: string;
};

export function IssueTable({
  issues,
  columns = ["status", "type", "updated"],
  emptyMessage = "No issues",
}: IssueTableProps) {
  if (issues.length === 0) {
    return <p className="text-sm text-app-text-muted py-4">{emptyMessage}</p>;
  }

  const cols = columns ?? [];

  return (
    <div className="app-table-wrap">
      <table className="w-full text-sm">
        <thead className="app-table-head w-full">
          <tr>
            <th className="px-3 py-2 text-left">Ticket</th>
            {cols.includes("status") && <th className="px-3 py-2 text-left">Status</th>}
            {cols.includes("type") && <th className="px-3 py-2 text-left">Type</th>}
            {cols.includes("assignee") && <th className="px-3 py-2 text-left">Assignee</th>}
            {cols.includes("priority") && <th className="px-3 py-2 text-left">Priority</th>}
            {cols.includes("project") && <th className="px-3 py-2 text-left">Project</th>}
            {cols.includes("duedate") && <th className="px-3 py-2 text-left">Due</th>}
            {cols.includes("updated") && <th className="px-3 py-2 text-left">Updated</th>}
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.key} className="app-table-row">
              <td className="px-3 py-2 font-mono text-sky-800 dark:text-sky-200 max-w-md">
                <JiraIssueLink issueKey={i.key} text={`${i.key} — ${i.summary}`} className="hover:underline" />
              </td>
              {cols.includes("status") && <td className="px-3 py-2">{i.status}</td>}
              {cols.includes("type") && <td className="px-3 py-2">{i.issuetype}</td>}
              {cols.includes("assignee") && <td className="px-3 py-2">{i.assignee}</td>}
              {cols.includes("priority") && <td className="px-3 py-2">{i.priority || "—"}</td>}
              {cols.includes("project") && <td className="px-3 py-2">{i.projectKey ?? "—"}</td>}
              {cols.includes("duedate") && <td className="px-3 py-2 text-app-text-muted text-xs">{i.duedate ?? "—"}</td>}
              {cols.includes("updated") && (
                <td className="px-3 py-2 text-app-text-muted text-xs whitespace-nowrap">{formatUpdated(i.updated)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatUpdated(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
