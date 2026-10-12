/* eslint-disable @typescript-eslint/naming-convention */
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { buildTimeEntryExportRows } from './time-entry-export';
import { combineDayAndTime } from './time-entry.util';
import { toExcelDateTime, toExcelDuration } from './xlsx-writer';

const H = 60 * 60 * 1000;
const at = (day: string, time: string): number => combineDayAndTime(day, time);

const createTask = (id: string, changes: Partial<Task> = {}): Task => ({
  ...DEFAULT_TASK,
  id,
  title: `Task ${id}`,
  projectId: 'p1',
  ...changes,
});

describe('buildTimeEntryExportRows', () => {
  const projectTitles = { p1: 'Project 1' };

  it('creates a row per entry with times, durations, task, project and fields', () => {
    const task = createTask('t1', {
      timeSpentOnDay: { '2026-10-10': 1.5 * H },
      timeEntries: [
        {
          id: 'e1',
          start: at('2026-10-10', '09:00'),
          end: at('2026-10-10', '10:30'),
          fields: { requestedBy: 'Anna', ticketNr: 'T-42' },
          note: 'Wrote the summary',
        },
      ],
    });

    expect(
      buildTimeEntryExportRows([task], projectTitles, {}, '2026-10-01', '2026-10-31', 0),
    ).toEqual([
      [
        { value: toExcelDateTime(at('2026-10-10', '00:00')), format: 'date' },
        { value: toExcelDateTime(at('2026-10-10', '09:00')), format: 'time' },
        { value: toExcelDateTime(at('2026-10-10', '10:30')), format: 'time' },
        { value: toExcelDuration(1.5 * H), format: 'duration' },
        { value: 1.5, format: 'decimal' },
        'Task t1',
        'Project 1',
        'Anna',
        'T-42',
        '',
        'Wrote the summary',
      ],
    ]);
  });

  it('adds a row without times for tracked time that has no entry', () => {
    const task = createTask('t1', {
      timeSpentOnDay: { '2026-10-10': 3 * H, '2026-10-11': 30 * 1000 },
      timeEntries: [
        { id: 'e1', start: at('2026-10-10', '09:00'), end: at('2026-10-10', '10:00') },
      ],
    });

    const rows = buildTimeEntryExportRows(
      [task],
      projectTitles,
      {},
      '2026-10-01',
      '2026-10-31',
      0,
    );

    // the entry first, then 2h without times; the 30s on the 11th are noise
    expect(rows.length).toBe(2);
    expect(rows[1].slice(1, 5)).toEqual([
      null,
      null,
      { value: toExcelDuration(2 * H), format: 'duration' },
      { value: 2, format: 'decimal' },
    ]);
  });

  it('only includes entries starting within the range', () => {
    const task = createTask('t1', {
      timeSpentOnDay: { '2026-09-30': H, '2026-10-01': H },
      timeEntries: [
        { id: 'e1', start: at('2026-09-30', '23:00'), end: at('2026-10-01', '01:00') },
      ],
    });

    expect(
      buildTimeEntryExportRows([task], projectTitles, {}, '2026-10-01', '2026-10-31', 0),
    ).toEqual([]);
  });

  it('skips parent tasks for time without entries and sorts by day and start', () => {
    const parent = createTask('parent', {
      subTaskIds: ['b'],
      timeSpentOnDay: { '2026-10-10': 2 * H },
    });
    const a = createTask('a', {
      timeSpentOnDay: { '2026-10-10': H },
    });
    const b = createTask('b', {
      timeSpentOnDay: { '2026-10-09': H, '2026-10-10': H },
      timeEntries: [
        { id: 'e2', start: at('2026-10-10', '08:00'), end: at('2026-10-10', '09:00') },
        { id: 'e1', start: at('2026-10-09', '08:00'), end: at('2026-10-09', '09:00') },
      ],
    });

    const rows = buildTimeEntryExportRows(
      [parent, a, b],
      projectTitles,
      {},
      '2026-10-01',
      '2026-10-31',
      0,
    );

    expect(rows.map((r) => [r[0], r[1] ? 'timed' : 'untimed', r[5]])).toEqual([
      [
        { value: toExcelDateTime(at('2026-10-09', '00:00')), format: 'date' },
        'timed',
        'Task b',
      ],
      [
        { value: toExcelDateTime(at('2026-10-10', '00:00')), format: 'date' },
        'timed',
        'Task b',
      ],
      [
        { value: toExcelDateTime(at('2026-10-10', '00:00')), format: 'date' },
        'untimed',
        'Task a',
      ],
    ]);
  });
});
