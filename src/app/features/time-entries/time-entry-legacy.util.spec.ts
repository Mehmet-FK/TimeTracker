/* eslint-disable @typescript-eslint/naming-convention */
import { getEarliestWorkStarts, planLegacyEntries } from './time-entry-legacy.util';
import { combineDayAndTime } from './time-entry.util';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { TimeTrackingState } from '../time-tracking/time-tracking.model';

const H = 60 * 60 * 1000;
const at = (day: string, time: string): number => combineDayAndTime(day, time);
const createTask = (id: string, extra: Partial<Task> = {}): Task => ({
  ...DEFAULT_TASK,
  id,
  title: id,
  projectId: '',
  ...extra,
});

describe('time-entry-legacy.util', () => {
  describe('getEarliestWorkStarts', () => {
    it('takes the earliest start per day over projects and tags', () => {
      const state = {
        project: {
          p1: { '2026-10-01': { s: at('2026-10-01', '10:00') } },
          p2: { '2026-10-01': { s: at('2026-10-01', '08:15') } },
        },
        tag: { t1: { '2026-10-02': { s: at('2026-10-02', '07:30'), e: 1 } } },
      } as unknown as TimeTrackingState;

      expect(getEarliestWorkStarts(state)).toEqual({
        '2026-10-01': at('2026-10-01', '08:15'),
        '2026-10-02': at('2026-10-02', '07:30'),
      });
    });
  });

  describe('planLegacyEntries', () => {
    it('places the untimed time of the day one after another from the work start', () => {
      const plans = planLegacyEntries(
        [
          createTask('b', { created: 2, timeSpentOnDay: { '2026-10-01': H } }),
          createTask('a', { created: 1, timeSpentOnDay: { '2026-10-01': 2 * H } }),
        ],
        { '2026-10-01': at('2026-10-01', '08:15') + 30_000 },
        0,
      );

      // sorted by creation, start rounded down to the minute
      expect(plans).toEqual([
        { taskId: 'a', start: at('2026-10-01', '08:15'), end: at('2026-10-01', '10:15') },
        { taskId: 'b', start: at('2026-10-01', '10:15'), end: at('2026-10-01', '11:15') },
      ]);
    });

    it('starts at 09:00 without a recorded work start', () => {
      const [plan] = planLegacyEntries(
        [createTask('a', { timeSpentOnDay: { '2026-10-01': H } })],
        {},
        0,
      );

      expect(plan.start).toBe(at('2026-10-01', '09:00'));
    });

    it('only converts the time not covered by entries', () => {
      const plans = planLegacyEntries(
        [
          createTask('a', {
            timeSpentOnDay: { '2026-10-01': 3 * H, '2026-10-02': H },
            timeEntries: [
              {
                id: 'e1',
                start: at('2026-10-01', '13:00'),
                end: at('2026-10-01', '14:00'),
              },
              {
                id: 'e2',
                start: at('2026-10-02', '13:00'),
                end: at('2026-10-02', '14:00'),
              },
            ],
          }),
        ],
        {},
        0,
      );

      expect(plans).toEqual([
        { taskId: 'a', start: at('2026-10-01', '09:00'), end: at('2026-10-01', '11:00') },
      ]);
    });

    it('moves the entries earlier to keep them within the day', () => {
      const [plan] = planLegacyEntries(
        [createTask('a', { timeSpentOnDay: { '2026-10-01': 4 * H } })],
        { '2026-10-01': at('2026-10-01', '22:00') },
        0,
      );

      expect(plan).toEqual({
        taskId: 'a',
        start: at('2026-10-01', '20:00'),
        end: at('2026-10-02', '00:00'),
      });
    });

    it('leaves out parent tasks, rounding noise and skipped days', () => {
      const plans = planLegacyEntries(
        [
          createTask('parent', {
            subTaskIds: ['a'],
            timeSpentOnDay: { '2026-10-01': H },
          }),
          createTask('a', {
            timeSpentOnDay: { '2026-10-01': 30 * 1000, '2026-10-03': H },
          }),
        ],
        {},
        0,
        ['2026-10-03'],
      );

      expect(plans).toEqual([]);
    });
  });
});
