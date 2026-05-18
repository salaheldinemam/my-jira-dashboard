import { useEffect, useState } from "react";
import { api } from "../../api";
import { useUiStore } from "../../store";

type ProjectRes = { values: { key: string; name: string }[] };

export function HomeProjectFilter() {
  const { projectKeys, setProjectKeys } = useUiStore();
  const [projects, setProjects] = useState<{ key: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await api<ProjectRes>("/api/projects");
        if (alive) setProjects(data.values ?? []);
      } catch {
        if (alive) setProjects([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function toggle(key: string) {
    if (projectKeys.includes(key)) setProjectKeys(projectKeys.filter((k) => k !== key));
    else setProjectKeys([...projectKeys, key]);
  }

  return (
    <div className="app-card-muted p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-sm text-slate-700 dark:text-slate-300">Project filter</span>
        {projectKeys.length > 0 && (
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-300"
            onClick={() => setProjectKeys([])}
          >
            Clear all
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-slate-500">All projects (no filter)</p>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {projects.map((p) => (
            <label
              key={p.key}
              className={`flex items-center gap-2 text-sm px-2 py-1 rounded-md cursor-pointer border ${
                projectKeys.includes(p.key)
                  ? "border-sky-600 bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
                  : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-transparent"
              }`}
            >
              <input
                type="checkbox"
                className="rounded border-slate-400 dark:border-slate-600"
                checked={projectKeys.includes(p.key)}
                onChange={() => toggle(p.key)}
              />
              {p.key}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
