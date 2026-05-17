import { useState } from "react";
import { IssueTable } from "../IssueTable";
import type { IssueRow } from "../../types";
import { WidgetCard } from "./WidgetCard";

type Tab = "ready" | "under" | "failed";

export function TestingQueuePanel({
  testing,
}: {
  testing: { ready: IssueRow[]; under: IssueRow[]; failed: IssueRow[] };
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
    <WidgetCard title="My testing queue" subtitle="Tickets in testing-related statuses">
      <div className="flex gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              tab === t.id
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>
      <IssueTable issues={issues} columns={["status", "updated"]} emptyMessage="No tickets in this queue" />
    </WidgetCard>
  );
}
