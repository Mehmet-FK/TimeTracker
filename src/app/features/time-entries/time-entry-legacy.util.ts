import { Task } from '../tasks/task.model';
import { TimeTrackingState } from '../time-tracking/time-tracking.model';
import { combineDayAndTime, splitDurationByDay } from './time-entry.util';

/** Untimed remainders below this are rounding noise from live tracking. */
const MIN_UNTIMED_MS = 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DEFAULT_DAY_START = '09:00';

export interface LegacyEntryPlan {
  taskId: string;
  start: number;
  end: number;
}

/** Earliest recorded work start per day over all projects and tags. */
export const getEarliestWorkStarts = (
  state: TimeTrackingState,
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const byContext of [state.project, state.tag]) {
    for (const byDay of Object.values(byContext || {})) {
      for (const [day, data] of Object.entries(byDay || {})) {
        if (data?.s && (!(day in result) || data.s < result[day])) {
          result[day] = data.s;
        }
      }
    }
  }
  return result;
};

/**
 * Entries for time tracked without start and end (e.g. before time entries
 * existed). Times are estimated: per day the untimed time of each task becomes
 * one entry, placed one after another from the day's first recorded work start
 * (or 09:00), and moved earlier where needed to stay within the day, so the
 * day totals do not change. Days in `skipDays` are left out.
 */
export const planLegacyEntries = (
  tasks: Task[],
  workStarts: Record<string, number>,
  startOfNextDayDiffMs: number,
  skipDays: string[] = [],
): LegacyEntryPlan[] => {
  const untimedByDay: Record<string, { task: Task; duration: number }[]> = {};

  for (const task of tasks) {
    // parent totals are the sum of their sub tasks
    if (task.subTaskIds?.length) {
      continue;
    }
    const entryTimeByDay: Record<string, number> = {};
    for (const entry of task.timeEntries || []) {
      const byDay = splitDurationByDay(entry.start, entry.end, startOfNextDayDiffMs);
      for (const [day, duration] of Object.entries(byDay)) {
        entryTimeByDay[day] = (entryTimeByDay[day] || 0) + duration;
      }
    }
    for (const [day, timeSpent] of Object.entries(task.timeSpentOnDay || {})) {
      const duration = timeSpent - (entryTimeByDay[day] || 0);
      if (duration >= MIN_UNTIMED_MS && !skipDays.includes(day)) {
        (untimedByDay[day] ||= []).push({ task, duration });
      }
    }
  }

  const plans: LegacyEntryPlan[] = [];
  for (const day of Object.keys(untimedByDay).sort()) {
    const items = untimedByDay[day].sort((a, b) => a.task.created - b.task.created);
    const total = items.reduce((sum, item) => sum + item.duration, 0);
    const dayStart = combineDayAndTime(day, '00:00') + startOfNextDayDiffMs;
    const dayEnd = combineDayAndTime(day, '00:00', 1) + startOfNextDayDiffMs;
    const preferred =
      Math.floor(
        (workStarts[day] ?? combineDayAndTime(day, DEFAULT_DAY_START)) / MINUTE_MS,
      ) * MINUTE_MS;
    let cursor = Math.max(dayStart, Math.min(preferred, dayEnd - total));
    for (const { task, duration } of items) {
      plans.push({ taskId: task.id, start: cursor, end: cursor + duration });
      cursor += duration;
    }
  }
  return plans;
};
