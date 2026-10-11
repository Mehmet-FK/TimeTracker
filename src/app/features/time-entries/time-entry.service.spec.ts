/* eslint-disable @typescript-eslint/naming-convention */
import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { DEFAULT_TASK, Task, TaskArchive } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { TaskTimeSyncService } from '../tasks/task-time-sync.service';
import { TaskArchiveService } from '../archive/task-archive.service';
import { DateService } from '../../core/date/date.service';
import { selectAllTasks } from '../tasks/store/task.selectors';
import { selectAllProjects } from '../project/store/project.selectors';
import { TranslateService } from '@ngx-translate/core';
import { strFromU8, unzipSync } from 'fflate';
import { TimeEntryService } from './time-entry.service';
import { combineDayAndTime } from './time-entry.util';

const H = 60 * 60 * 1000;
const at = (day: string, time: string): number => combineDayAndTime(day, time);

const createTask = (id: string, changes: Partial<Task> = {}): Task => ({
  ...DEFAULT_TASK,
  id,
  title: `Task ${id}`,
  projectId: 'p1',
  ...changes,
});

describe('TimeEntryService', () => {
  let service: TimeEntryService;
  let tasks: Record<string, Task>;
  let taskService: jasmine.SpyObj<TaskService>;
  let taskTimeSync: jasmine.SpyObj<TaskTimeSyncService>;
  let archive: TaskArchive;

  const lastChanges = (): Partial<Task> =>
    taskService.updateEverywhere.calls.mostRecent().args[1];

  beforeEach(() => {
    tasks = {};
    archive = { ids: [], entities: {} };
    taskService = jasmine.createSpyObj<TaskService>('TaskService', [
      'getByIdFromEverywhere',
      'updateEverywhere',
    ]);
    taskService.getByIdFromEverywhere.and.callFake(async (id: string) => {
      if (!tasks[id]) {
        throw new Error('not found');
      }
      return tasks[id];
    });
    taskService.updateEverywhere.and.callFake(async (id: string, changes) => {
      tasks[id] = { ...tasks[id], ...changes };
    });
    taskTimeSync = jasmine.createSpyObj<TaskTimeSyncService>('TaskTimeSyncService', [
      'flushOne',
    ]);

    TestBed.configureTestingModule({
      providers: [
        TimeEntryService,
        provideMockStore({
          selectors: [
            { selector: selectAllTasks, value: [] },
            { selector: selectAllProjects, value: [{ id: 'p1', title: 'Project 1' }] },
          ],
        }),
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: TaskService, useValue: taskService },
        { provide: TaskTimeSyncService, useValue: taskTimeSync },
        { provide: TaskArchiveService, useValue: { load: async () => archive } },
        { provide: DateService, useValue: { getStartOfNextDayDiffMs: () => 0 } },
      ],
    });
    service = TestBed.inject(TimeEntryService);
  });

  describe('addTrackedEntry', () => {
    it('stores the entry without changing timeSpentOnDay', async () => {
      tasks.t1 = createTask('t1', { timeSpentOnDay: { '2026-10-10': H } });

      await service.addTrackedEntry(
        't1',
        at('2026-10-10', '09:00'),
        at('2026-10-10', '10:00'),
      );

      expect(lastChanges().timeSpentOnDay).toBeUndefined();
      expect(tasks.t1.timeEntries).toEqual([
        jasmine.objectContaining({
          start: at('2026-10-10', '09:00'),
          end: at('2026-10-10', '10:00'),
        }),
      ]);
    });

    it('ignores deleted tasks', async () => {
      await service.addTrackedEntry('missing', 0, 1000);
      expect(taskService.updateEverywhere).not.toHaveBeenCalled();
    });
  });

  describe('addEntry', () => {
    it('adds the entry and its time, split across midnight', async () => {
      tasks.t1 = createTask('t1', { timeSpentOnDay: { '2026-10-10': H } });

      await service.addEntry('t1', at('2026-10-10', '23:00'), at('2026-10-11', '01:00'));

      expect(taskTimeSync.flushOne).toHaveBeenCalledWith('t1');
      expect(tasks.t1.timeSpentOnDay).toEqual({ '2026-10-10': 2 * H, '2026-10-11': H });
      expect(tasks.t1.timeEntries?.length).toBe(1);
    });

    it('rejects an end before the start', async () => {
      tasks.t1 = createTask('t1');
      await expectAsync(service.addEntry('t1', 2000, 1000)).toBeRejected();
      expect(taskService.updateEverywhere).not.toHaveBeenCalled();
    });
  });

  describe('updateEntry', () => {
    beforeEach(() => {
      tasks.t1 = createTask('t1', {
        timeSpentOnDay: { '2026-10-10': 3 * H },
        timeEntries: [
          { id: 'e1', start: at('2026-10-10', '09:00'), end: at('2026-10-10', '10:00') },
        ],
      });
      tasks.t2 = createTask('t2');
    });

    it('applies the duration difference', async () => {
      await service.updateEntry(
        't1',
        'e1',
        at('2026-10-10', '09:00'),
        at('2026-10-10', '11:30'),
      );

      expect(tasks.t1.timeSpentOnDay).toEqual({ '2026-10-10': 4.5 * H });
      expect(tasks.t1.timeEntries).toEqual([
        { id: 'e1', start: at('2026-10-10', '09:00'), end: at('2026-10-10', '11:30') },
      ]);
    });

    it('moves the time to another day when the date changes', async () => {
      await service.updateEntry(
        't1',
        'e1',
        at('2026-10-12', '09:00'),
        at('2026-10-12', '10:00'),
      );

      expect(tasks.t1.timeSpentOnDay).toEqual({
        '2026-10-10': 2 * H,
        '2026-10-12': H,
      });
    });

    it('moves the entry to another task', async () => {
      await service.updateEntry(
        't1',
        'e1',
        at('2026-10-10', '09:00'),
        at('2026-10-10', '10:00'),
        't2',
      );

      expect(tasks.t1.timeEntries).toEqual([]);
      expect(tasks.t1.timeSpentOnDay).toEqual({ '2026-10-10': 2 * H });
      expect(tasks.t2.timeEntries?.length).toBe(1);
      expect(tasks.t2.timeSpentOnDay).toEqual({ '2026-10-10': H });
    });
  });

  describe('deleteEntry', () => {
    it('removes the entry and its time', async () => {
      tasks.t1 = createTask('t1', {
        timeSpentOnDay: { '2026-10-10': H },
        timeEntries: [
          { id: 'e1', start: at('2026-10-10', '09:00'), end: at('2026-10-10', '10:00') },
        ],
      });

      await service.deleteEntry('t1', 'e1');

      expect(tasks.t1.timeEntries).toEqual([]);
      expect(tasks.t1.timeSpentOnDay).toEqual({});
    });

    it('throws for an unknown entry', async () => {
      tasks.t1 = createTask('t1');
      await expectAsync(service.deleteEntry('t1', 'nope')).toBeRejected();
    });
  });

  describe('getEntriesForDay', () => {
    it('collects entries of live and archived tasks and the day totals', async () => {
      const store = TestBed.inject(MockStore);
      const live = createTask('live', {
        timeSpentOnDay: { '2026-10-10': 3 * H },
        timeEntries: [
          { id: 'e2', start: at('2026-10-10', '13:00'), end: at('2026-10-10', '14:00') },
          {
            id: 'e-other-day',
            start: at('2026-10-09', '13:00'),
            end: at('2026-10-09', '14:00'),
          },
        ],
      });
      const parent = createTask('parent', {
        subTaskIds: ['live'],
        timeSpentOnDay: { '2026-10-10': 3 * H },
      });
      store.overrideSelector(selectAllTasks, [live, parent]);
      store.refreshState();
      const archived = createTask('archived', {
        timeSpentOnDay: { '2026-10-10': H },
        timeEntries: [
          { id: 'e1', start: at('2026-10-10', '09:00'), end: at('2026-10-10', '10:00') },
        ],
      });
      archive = { ids: ['archived'], entities: { archived } };

      const result = await service.getEntriesForDay('2026-10-10');

      expect(result.rows.map((r) => [r.entry.id, r.isArchived])).toEqual([
        ['e1', true],
        ['e2', false],
      ]);
      expect(result.entriesTotal).toBe(2 * H);
      // the parent is not counted twice
      expect(result.dayTotal).toBe(4 * H);
    });
  });

  describe('custom fields', () => {
    const entry = {
      id: 'e1',
      start: at('2026-10-10', '09:00'),
      end: at('2026-10-10', '10:00'),
    };

    it('stores trimmed field values with a new entry', async () => {
      tasks.t1 = createTask('t1');

      await service.addEntry('t1', entry.start, entry.end, {
        requestedBy: '  Anna  ',
        other: '   ',
      });

      expect(tasks.t1.timeEntries?.[0].fields).toEqual({ requestedBy: 'Anna' });
    });

    it('omits fields when there are no values', async () => {
      tasks.t1 = createTask('t1');

      await service.addTrackedEntry('t1', entry.start, entry.end, { requestedBy: '' });

      expect(tasks.t1.timeEntries?.[0]).not.toEqual(
        jasmine.objectContaining({ fields: jasmine.anything() }),
      );
    });

    it('updates and removes field values without touching the time', async () => {
      tasks.t1 = createTask('t1', {
        timeSpentOnDay: { '2026-10-10': H },
        timeEntries: [{ ...entry, fields: { requestedBy: 'Anna', other: 'x' } }],
      });

      await service.updateEntryFields('t1', 'e1', { requestedBy: 'Ben' });
      expect(tasks.t1.timeEntries?.[0].fields).toEqual({
        requestedBy: 'Ben',
        other: 'x',
      });
      expect(lastChanges().timeSpentOnDay).toBeUndefined();

      await service.updateEntryFields('t1', 'e1', { requestedBy: '', other: '' });
      expect(tasks.t1.timeEntries?.[0]).toEqual(entry);
    });

    it('keeps the field values when moving an entry to another task', async () => {
      tasks.t1 = createTask('t1', {
        timeSpentOnDay: { '2026-10-10': H },
        timeEntries: [{ ...entry, fields: { requestedBy: 'Anna' } }],
      });
      tasks.t2 = createTask('t2');

      await service.updateEntry('t1', 'e1', entry.start, entry.end, 't2');

      expect(tasks.t2.timeEntries?.[0].fields).toEqual({ requestedBy: 'Anna' });
    });

    it('lists used values, most recently used first', async () => {
      const store = TestBed.inject(MockStore);
      store.overrideSelector(selectAllTasks, [
        createTask('t1', {
          timeEntries: [
            { id: 'a', start: 1, end: 100, fields: { requestedBy: 'Anna' } },
            { id: 'b', start: 1, end: 300, fields: { requestedBy: 'Ben' } },
            { id: 'c', start: 1, end: 50 },
          ],
        }),
      ]);
      store.refreshState();
      archive = {
        ids: ['t2'],
        entities: {
          t2: createTask('t2', {
            timeEntries: [
              { id: 'd', start: 1, end: 200, fields: { requestedBy: 'Anna' } },
            ],
          }),
        },
      };

      expect(await service.getUsedFieldValues()).toEqual({
        requestedBy: ['Ben', 'Anna'],
      });
    });
  });

  describe('createXlsxExport', () => {
    it('creates a sheet with translated headers and the entries of the range', async () => {
      const store = TestBed.inject(MockStore);
      store.overrideSelector(selectAllTasks, [
        createTask('t1', {
          title: 'Write report',
          timeSpentOnDay: { '2026-10-10': H },
          timeEntries: [
            {
              id: 'e1',
              start: at('2026-10-10', '09:00'),
              end: at('2026-10-10', '10:00'),
              fields: { requestedBy: 'Anna' },
            },
          ],
        }),
      ]);
      store.refreshState();

      const sheet = strFromU8(
        unzipSync(await service.createXlsxExport('2026-10-01', '2026-10-31'))[
          'xl/worksheets/sheet1.xml'
        ],
      );

      expect(sheet).toContain('F.TIME_ENTRIES.FIELDS.REQUESTED_BY');
      expect(sheet).toContain('Write report');
      expect(sheet).toContain('Project 1');
      expect(sheet).toContain('Anna');
    });
  });
});
