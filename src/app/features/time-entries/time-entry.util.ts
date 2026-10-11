import { TimeEntry, TimeSpentOnDay } from '../tasks/task.model';
import { getDbDateStr } from '../../util/get-db-date-str';

/**
 * Logical day (YYYY-MM-DD) a timestamp belongs to, honouring the configured
 * start of the next day (e.g. a day that starts at 04:00).
 */
export const getLogicalDayStr = (ts: number, startOfNextDayDiffMs: number): string =>
  getDbDateStr(new Date(ts - startOfNextDayDiffMs));

/**
 * Splits the range [start, end) into durations per logical day, so an entry
 * crossing midnight counts towards both days.
 */
export const splitDurationByDay = (
  start: number,
  end: number,
  startOfNextDayDiffMs: number,
): Record<string, number> => {
  const result: Record<string, number> = {};
  let cursor = start;
  while (cursor < end) {
    const nextDayStart = new Date(cursor - startOfNextDayDiffMs);
    nextDayStart.setHours(24, 0, 0, 0);
    const boundary = nextDayStart.getTime() + startOfNextDayDiffMs;
    const segmentEnd = Math.min(boundary, end);
    const day = getLogicalDayStr(cursor, startOfNextDayDiffMs);
    result[day] = (result[day] || 0) + (segmentEnd - cursor);
    cursor = segmentEnd;
  }
  return result;
};

/**
 * Adds (sign = 1) or removes (sign = -1) an entry's duration to/from a
 * timeSpentOnDay map. Values never drop below zero; days reaching zero are
 * removed so they do not show up as empty worklog days.
 */
export const applyEntryToTimeSpentOnDay = (
  timeSpentOnDay: TimeSpentOnDay,
  entry: Pick<TimeEntry, 'start' | 'end'>,
  sign: 1 | -1,
  startOfNextDayDiffMs: number,
): TimeSpentOnDay => {
  const result: Record<string, number> = { ...timeSpentOnDay };
  const byDay = splitDurationByDay(entry.start, entry.end, startOfNextDayDiffMs);
  for (const [day, duration] of Object.entries(byDay)) {
    const signedDuration = sign * duration;
    const newVal = Math.max(0, (result[day] || 0) + signedDuration);
    if (newVal > 0) {
      result[day] = newVal;
    } else {
      delete result[day];
    }
  }
  return result;
};

/** True if the entry overlaps the given logical day. */
export const isEntryOnDay = (
  entry: Pick<TimeEntry, 'start' | 'end'>,
  day: string,
  startOfNextDayDiffMs: number,
): boolean => day in splitDurationByDay(entry.start, entry.end, startOfNextDayDiffMs);

export const sortTimeEntries = (entries: TimeEntry[]): TimeEntry[] =>
  [...entries].sort((a, b) => a.start - b.start);

/** Calendar date (YYYY-MM-DD, local time) of a timestamp, without day offset. */
export const getCalendarDayStr = (ts: number): string => getDbDateStr(new Date(ts));

/** 'HH:mm' in local time, as used by `<input type="time">`. */
export const toTimeInputValue = (ts: number): string => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Local timestamp for a calendar date ('YYYY-MM-DD') and a time ('HH:mm').
 * Returns NaN for malformed input.
 */
export const combineDayAndTime = (day: string, time: string, addDays = 0): number => {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!dayMatch || !timeMatch) {
    return NaN;
  }
  return new Date(
    +dayMatch[1],
    +dayMatch[2] - 1,
    +dayMatch[3] + addDays,
    +timeMatch[1],
    +timeMatch[2],
  ).getTime();
};

/**
 * Start/end timestamps for a new entry entered as times on a logical day.
 * Times before the configured start of the day belong to the next calendar
 * day, and an end not after the start means the entry runs past midnight.
 */
export const getRangeForLogicalDay = (
  day: string,
  startTime: string,
  endTime: string,
  startOfNextDayDiffMs: number,
): { start: number; end: number } => {
  const toTs = (time: string): number => {
    const ts = combineDayAndTime(day, time);
    const isBeforeDayStart = ts - combineDayAndTime(day, '00:00') < startOfNextDayDiffMs;
    return isBeforeDayStart ? combineDayAndTime(day, time, 1) : ts;
  };
  const start = toTs(startTime);
  let end = toTs(endTime);
  if (end <= start) {
    end = combineDayAndTime(getCalendarDayStr(end), endTime, 1);
  }
  return { start, end };
};

/** Moves a timestamp by whole calendar days, keeping its local time of day. */
export const shiftByDays = (ts: number, days: number): number => {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
};

/** Whole calendar days from one 'YYYY-MM-DD' date to another. */
export const getDayDiff = (fromDay: string, toDay: string): number =>
  Math.round(
    (combineDayAndTime(toDay, '12:00') - combineDayAndTime(fromDay, '12:00')) /
      (24 * 60 * 60 * 1000),
  );
