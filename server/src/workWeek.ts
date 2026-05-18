import { addDays, format, startOfDay } from "date-fns";

/** Work week: Sunday (0) through Thursday (4). */
export const WORK_WEEK_LENGTH_DAYS = 5;

export function workWeekStart(today: Date = startOfDay(new Date())): Date {
  return startOfDay(addDays(today, -today.getDay()));
}

export function workWeekEndExclusive(weekStart: Date): Date {
  return addDays(weekStart, WORK_WEEK_LENGTH_DAYS);
}

export function workWeekLastDay(weekStart: Date): Date {
  return addDays(weekStart, WORK_WEEK_LENGTH_DAYS - 1);
}

export function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function workWeekDateRange(weekStart: Date): { from: string; to: string } {
  return {
    from: isoDate(weekStart),
    to: isoDate(workWeekLastDay(weekStart)),
  };
}

/** Calendar day (local) for a Jira worklog `started` timestamp. */
export function worklogCalendarDay(started: string): string | null {
  const t = Date.parse(started);
  if (Number.isNaN(t)) return null;
  return isoDate(startOfDay(new Date(t)));
}

/** Whether a worklog falls on a Sun–Thu day in the work week containing `weekStart`. */
export function isWorklogInWorkWeek(started: string, weekStart: Date): boolean {
  const day = worklogCalendarDay(started);
  if (!day) return false;
  const { from, to } = workWeekDateRange(weekStart);
  return day >= from && day <= to;
}
