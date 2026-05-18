import { parseISO, format } from "date-fns";
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { api } from "../api";
import { useUiStore } from "../store";

type ProjectRes = { values: { key: string; name: string }[] };

export type PeriodMode = "yesterday" | "today" | "custom";

const PERIOD_MODES: { id: PeriodMode; label: string }[] = [
  { id: "yesterday", label: "Yesterday" },
  { id: "today", label: "Today" },
  { id: "custom", label: "Custom" },
];

type FiltersBarProps = {
  onApply?: () => void;
  applyLabel?: string;
  showDateFilters?: boolean;
  applyDisabled?: boolean;
  periodMode?: PeriodMode;
  onPeriodModeChange?: (mode: PeriodMode) => void;
};

export function FiltersBar({
  onApply,
  applyLabel = "Apply filters",
  showDateFilters = true,
  applyDisabled = false,
  periodMode,
  onPeriodModeChange,
}: FiltersBarProps) {
  const { projectKeys, setProjectKeys, dateFrom, dateTo, setDateRange } = useUiStore();
  const [projects, setProjects] = useState<{ key: string; name: string }[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadProjects() {
    if (projectsLoaded || projectsLoading) return;
    setErr(null);
    setProjectsLoading(true);
    try {
      const data = await api<ProjectRes>("/api/projects");
      setProjects(data.values ?? []);
      setProjectsLoaded(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Projects unavailable");
    } finally {
      setProjectsLoading(false);
    }
  }

  function toggleProject(key: string) {
    if (projectKeys.includes(key)) setProjectKeys(projectKeys.filter((k) => k !== key));
    else setProjectKeys([...projectKeys, key]);
  }

  function parseDateOrNull(value: string) {
    if (!value) return null;
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function toIsoDateOrCurrent(value: Date | null, fallback: string) {
    if (!value) return fallback;
    return format(value, "yyyy-MM-dd");
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  return (
    <div className="app-card-muted p-4 mb-6 space-y-3">
      {periodMode !== undefined && onPeriodModeChange && (
        <div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">Period</div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_MODES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onPeriodModeChange(id)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  periodMode === id
                    ? "border-sky-500 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-700 dark:text-sky-200"
                    : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {showDateFilters && (
        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            From
            <DatePicker
              selected={parseDateOrNull(dateFrom)}
              onChange={(date) => setDateRange(toIsoDateOrCurrent(date, dateFrom), dateTo)}
              dateFormat="yyyy-MM-dd"
              className="app-input px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            To
            <DatePicker
              selected={parseDateOrNull(dateTo)}
              onChange={(date) => setDateRange(dateFrom, toIsoDateOrCurrent(date, dateTo))}
              dateFormat="yyyy-MM-dd"
              className="app-input px-2 py-1.5"
            />
          </label>
        </div>
      )}
      <div>
        <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">Projects (optional — empty = all)</div>
        {projectsLoading && <div className="text-xs text-slate-500 mb-3">Loading projects...</div>}
        {err && <div className="text-amber-700 dark:text-amber-400 text-sm mb-2">{err}</div>}
        <div className="flex flex-wrap gap-2 mb-3">
          {projects.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => toggleProject(p.key)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                projectKeys.includes(p.key)
                  ? "border-sky-500 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-700 dark:text-sky-200"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-500"
              }`}
            >
              {p.key}
            </button>
          ))}
        </div>
        {onApply && (
          <button
            type="button"
            onClick={onApply}
            disabled={applyDisabled}
            className="px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-sky-600"
          >
            {applyLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function projectQuery(projectKeys: string[]) {
  if (!projectKeys.length) return "";
  return `&projects=${encodeURIComponent(projectKeys.join(","))}`;
}
