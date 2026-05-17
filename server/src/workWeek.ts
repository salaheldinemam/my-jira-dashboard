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
