/**
 * Maps logical PRD buckets to Jira status names.
 * Teams customize names in Settings; these defaults match common Jira workflows.
 */
export const DEFAULT_STATUS_MAPPING: Record<string, string[]> = {
  open: ["Open", "To Do", "Backlog", "New", "Selected for Development"],
  inProgress: ["In Progress", "Doing", "Development", "Code Review"],
  readyForTesting: [
    "Ready for Testing",
    "Ready For Testing",
    "Ready to Test",
    "Ready For Test",
    "Ready for QA",
    "Ready For QA",
  ],
  underTesting: ["In Testing", "Under Testing", "QA", "Testing"],
  reopened: ["Reopened"],
  failedTesting: ["Failed Testing", "Failed QA", "Testing Failed"],
  underInvestigation: ["Under Investigation", "Blocked", "On Hold"],
};

export type StatusMapping = Record<string, string[]>;

export function mergeStatusMapping(override?: Partial<StatusMapping> | null): StatusMapping {
  const out: StatusMapping = { ...DEFAULT_STATUS_MAPPING };
  if (!override) return out;
  for (const [k, v] of Object.entries(override)) {
    if (Array.isArray(v) && v.length) out[k] = v;
  }
  return out;
}

export function statusesForKeys(mapping: StatusMapping, keys: string[]): string[] {
  const set = new Set<string>();
  for (const key of keys) {
    for (const s of mapping[key] ?? []) set.add(s);
  }
  return [...set];
}

export function jqlStatusIn(statusNames: string[]): string {
  const escaped = statusNames.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(", ");
  return `status in (${escaped})`;
}

export function jqlStatusNotIn(statusNames: string[]): string {
  const escaped = statusNames.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(", ");
  return `status not in (${escaped})`;
}
