import { useEffect, useState } from "react";
import { api } from "../api";
import { useUiStore } from "../store";
import type { SprintOption } from "../types";

type ProjectRes = { values: { key: string; name: string }[] };

type SprintFiltersBarProps = {
  onApply: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
};

export function SprintFiltersBar({
  onApply,
  applyLabel = "Load sprint dashboard",
  applyDisabled = false,
}: SprintFiltersBarProps) {
  const { projectKeys, setProjectKeys, sprintId, setSprintId } = useUiStore();
  const [projects, setProjects] = useState<{ key: string; name: string }[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [sprintsLoading, setSprintsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadProjects() {
    if (projectsLoaded || projectsLoading) return;
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

  async function loadSprints() {
    if (!projectKeys.length) {
      setSprints([]);
      return;
    }
    setSprintsLoading(true);
    setErr(null);
    try {
      const res = await api<{ sprints: SprintOption[] }>(
        `/api/sprints?projects=${encodeURIComponent(projectKeys.join(","))}`
      );
      setSprints(res.sprints ?? []);
      if (sprintId && !res.sprints.some((s) => s.id === sprintId)) {
        setSprintId(res.sprints[0]?.id ?? null);
      } else if (!sprintId && res.sprints[0]) {
        setSprintId(res.sprints[0].id);
      }
    } catch (e) {
      setSprints([]);
      setErr(e instanceof Error ? e.message : "Failed to load sprints");
    } finally {
      setSprintsLoading(false);
    }
  }

  function toggleProject(key: string) {
    if (projectKeys.includes(key)) setProjectKeys(projectKeys.filter((k) => k !== key));
    else setProjectKeys([...projectKeys, key]);
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    void loadSprints();
  }, [projectKeys.join(",")]);

  return (
    <div className="app-card-muted p-4 mb-6 space-y-3">
      <div>
        <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
          Projects (required — select at least one)
        </div>
        {projectsLoading && <div className="text-xs text-slate-500 mb-3">Loading projects…</div>}
        {err && <div className="text-amber-700 dark:text-amber-400 text-sm mb-2">{err}</div>}
        <div className="flex flex-wrap gap-2 mb-3">
          {projects.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => toggleProject(p.key)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                projectKeys.includes(p.key)
                  ? "border-sky-500 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-500"
              }`}
            >
              {p.key}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">Sprint</div>
        {sprintsLoading && <div className="text-xs text-slate-500 mb-2">Loading open sprints…</div>}
        {!projectKeys.length && (
          <div className="text-xs text-slate-500 mb-2">Select project(s) to list active and upcoming sprints.</div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <select
            className="app-input px-2 py-1.5 text-sm max-w-md w-full min-w-[12rem]"
            value={sprintId ?? ""}
            disabled={!projectKeys.length || sprintsLoading || sprints.length === 0}
            onChange={(e) => {
              const v = e.target.value;
              setSprintId(v ? Number(v) : null);
            }}
          >
            <option value="">Select a sprint</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.state})
                {s.endDate ? ` — ends ${s.endDate.slice(0, 10)}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onApply}
            disabled={applyDisabled || !projectKeys.length || !sprintId}
            className="px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-sky-600"
          >
            {applyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
