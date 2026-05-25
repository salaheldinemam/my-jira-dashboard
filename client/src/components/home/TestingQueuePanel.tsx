import { useState } from "react";
import { IssueTable } from "../IssueTable";
import type { IssueRow } from "../../types";
import { WidgetCard } from "./WidgetCard";

type Tab = "ready" | "under" | "failed";

type TableColumn = "status" | "type" | "priority" | "duedate" | "updated" | "project" | "assignee";

export function TestingQueuePanel({
  testing,
  title = "My testing queue",
  subtitle = "Tickets in testing-related statuses",
  tableColumns = ["status", "updated"],
}: {
  testing: { ready: IssueRow[]; under: IssueRow[]; failed: IssueRow[] };
  title?: string;
  subtitle?: string;
  tableColumns?: TableColumn[];
}) {
  const [tab, setTab] = useState<Tab>("ready");
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "ready", label: "Ready", count: testing.ready.length },
    { id: "under", label: "In test", count: testing.under.length },
    { id: "failed", label: "Failed", count: testing.failed.length },
  ];
  const issues =
    tab === "ready" ? testing.ready : tab === "under" ? testing.under : testing.failed;

  return (
    <WidgetCard title={title} subtitle={subtitle}>
      <div className="flex gap-1 mb-4 p-1 rounded-lg border border-app-border bg-app-surface-muted w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              tab === t.id
                ? "bg-app-surface text-app-text shadow-sm font-medium border border-app-border"
                : "text-app-text-muted hover:text-app-text"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>
      <IssueTable issues={issues} columns={tableColumns} emptyMessage="No tickets in this queue" />
    </WidgetCard>
  );
}
