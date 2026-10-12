import { Task } from '../tasks/task.model';
import { TIME_ENTRY_FIELDS } from './time-entry-fields.const';
import {
  combineDayAndTime,
  getLogicalDayStr,
  splitDurationByDay,
} from './time-entry.util';
import { toExcelDateTime, toExcelDuration, XlsxCell } from './xlsx-writer';

/** Untimed remainders below this are rounding noise from live tracking. */
const MIN_UNTIMED_MS = 60 * 1000;

interface ExportRecord {
  day: string;
  start?: number;
  end?: number;
  duration: number;
  task: Task;
  fields?: Record<string, string>;
  note?: string;
  tagIds?: string[];
}

/**
 * One row per time entry starting within [fromDay, toDay] (logical days,
 * inclusive), plus one row without start/end per task and day for tracked time
 * that has no entry (e.g. tracked before time entries existed).
 *
 * Columns: date, start, end, duration, duration in hours, task, project, one
 * column per custom field, the tags (comma separated) and the note.
 */
export const buildTimeEntryExportRows = (
  tasks: Task[],
  projectTitles: Record<string, string>,
  tagTitles: Record<string, string>,
  fromDay: string,
  toDay: string,
  startOfNextDayDiffMs: number,
): XlsxCell[][] => {
  const isInRange = (day: string): boolean => day >= fromDay && day <= toDay;
  const records: ExportRecord[] = [];

  for (const task of tasks) {
    const entryTimeByDay: Record<string, number> = {};
    for (const entry of task.timeEntries || []) {
      const byDay = splitDurationByDay(entry.start, entry.end, startOfNextDayDiffMs);
      for (const [day, duration] of Object.entries(byDay)) {
        entryTimeByDay[day] = (entryTimeByDay[day] || 0) + duration;
      }
      const day = getLogicalDayStr(entry.start, startOfNextDayDiffMs);
      if (isInRange(day)) {
        records.push({
          day,
          start: entry.start,
          end: entry.end,
          duration: entry.end - entry.start,
          task,
          fields: entry.fields,
          note: entry.note,
          tagIds: entry.tagIds,
        });
      }
    }

    // parent totals are the sum of their sub tasks
    if (task.subTaskIds.length) {
      continue;
    }
    for (const [day, timeSpent] of Object.entries(task.timeSpentOnDay || {})) {
      const untimed = timeSpent - (entryTimeByDay[day] || 0);
      if (isInRange(day) && untimed >= MIN_UNTIMED_MS) {
        records.push({ day, duration: untimed, task });
      }
    }
  }

  records.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (a.start ?? Infinity) - (b.start ?? Infinity) ||
      a.task.title.localeCompare(b.task.title),
  );

  return records.map((r) => [
    { value: toExcelDateTime(combineDayAndTime(r.day, '00:00')), format: 'date' },
    r.start === undefined ? null : { value: toExcelDateTime(r.start), format: 'time' },
    r.end === undefined ? null : { value: toExcelDateTime(r.end), format: 'time' },
    { value: toExcelDuration(r.duration), format: 'duration' },
    { value: Math.round(r.duration / 36000) / 100, format: 'decimal' },
    r.task.title,
    projectTitles[r.task.projectId] || '',
    ...TIME_ENTRY_FIELDS.map((f) => r.fields?.[f.id] || ''),
    (r.tagIds || [])
      .map((id) => tagTitles[id])
      .filter((title) => !!title)
      .join(', '),
    r.note || '',
  ]);
};
