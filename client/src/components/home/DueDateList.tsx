import { JiraIssueLink } from "../JiraIssueLink";
import type { IssueRow } from "../../types";
import { WidgetCard } from "./WidgetCard";

export function DueDateList({
  overdue,
  dueSoon,
}: {
  overdue: IssueRow[];
  dueSoon: IssueRow[];
}) {
  return (
    <WidgetCard title="Due dates" subtitle="Overdue and due in the next 7 days">
      <div className="grid md:grid-cols-2 gap-6">
        <DueSection title="Overdue" items={overdue} tone="danger" />
        <DueSection title="Due soon" items={dueSoon} tone="warning" />
      </div>
    </WidgetCard>
  );
}

function DueSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: IssueRow[];
  tone: "danger" | "warning";
}) {
  const border = tone === "danger" ? "border-rose-900/50" : "border-amber-900/50";
  const badge = tone === "danger" ? "bg-rose-950/50 text-rose-200" : "bg-amber-950/50 text-amber-200";

  return (
    <div>
      <h3 className={`text-xs uppercase tracking-wide mb-2 px-2 py-1 rounded-md inline-block ${badge}`}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">None</p>
      ) : (
        <ul className={`space-y-2 rounded-lg border ${border} p-2`}>
          {items.map((i) => (
            <li key={i.key} className="text-sm">
              <JiraIssueLink issueKey={i.key} text={i.key} className="text-sky-300 font-mono hover:underline" />
              <span className="text-slate-400 ml-2 truncate">{i.summary}</span>
              {i.duedate && (
                <span className="block text-xs text-slate-500 mt-0.5">Due {i.duedate}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
