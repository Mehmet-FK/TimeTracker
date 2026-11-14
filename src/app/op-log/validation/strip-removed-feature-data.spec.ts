import {
  isRemovedFeatureDataPath,
  ISSUE_TASK_FIELDS,
  stripRemovedFeatureData,
} from './strip-removed-feature-data';
import {
  createCleanAppData,
  createOldAppDataWithRemovedFeatures,
  issueFieldsFor,
  REMOVED_PROVIDER_TYPES,
} from './test-fixtures/removed-feature-data.fixture';
import { DEFAULT_GLOBAL_CONFIG } from '../../features/config/default-global-config.const';

type Rec = Record<string, unknown>;
type EntityStateRec = { ids: string[]; entities: Record<string, Rec> };

const clean = (): Rec => createCleanAppData() as unknown as Rec;
const slice = (data: Rec, key: string): EntityStateRec => data[key] as EntityStateRec;
const archiveTasks = (data: Rec, key: 'archiveYoung' | 'archiveOld'): EntityStateRec =>
  (data[key] as Rec).task as EntityStateRec;
const cfg = (data: Rec): Record<string, Rec> =>
  data.globalConfig as Record<string, Rec>;

/** Every task, project, tag and time entry must equal the clean fixture. */
const expectCoreDataKept = (result: Rec): void => {
  const expected = clean();
  expect(slice(result, 'task').ids).toEqual(slice(expected, 'task').ids);
  expect(slice(result, 'task').entities).toEqual(slice(expected, 'task').entities);
  expect(archiveTasks(result, 'archiveYoung')).toEqual(
    archiveTasks(expected, 'archiveYoung'),
  );
  expect(archiveTasks(result, 'archiveOld')).toEqual(
    archiveTasks(expected, 'archiveOld'),
  );
  expect(result.project).toEqual(expected.project);
  expect(result.tag).toEqual(expected.tag);
  expect(result.timeTracking).toEqual(expected.timeTracking);
};

const linkTask = (data: Rec, taskId: string, type: string): void => {
  const tasks = slice(data, 'task');
  tasks.entities[taskId] = { ...tasks.entities[taskId], ...issueFieldsFor(type, 1) };
};

describe('stripRemovedFeatureData()', () => {
  describe('issue providers', () => {
    REMOVED_PROVIDER_TYPES.forEach((type) => {
      it(`drops ${type} provider data and keeps the linked task`, () => {
        const data = clean();
        data.issueProvider = {
          ids: [`ip-${type}`],
          entities: { [`ip-${type}`]: { id: `ip-${type}`, issueProviderKey: type } },
        };
        linkTask(data, 't1', type);
        const archived = archiveTasks(data, 'archiveYoung');
        archived.entities.a1 = { ...archived.entities.a1, ...issueFieldsFor(type, 2) };
        const p1 = slice(data, 'project').entities.P1;
        p1.issueIntegrationCfgs = { [type]: { isEnabled: true } };

        const result = stripRemovedFeatureData(data);

        expect(result.issueProvider).toEqual({ ids: [], entities: {} });
        const t1 = slice(result, 'task').entities.t1;
        ISSUE_TASK_FIELDS.forEach((f) => expect(f in t1).withContext(f).toBe(false));
        expect(JSON.stringify(result)).not.toContain(`${type}-1`);
        expectCoreDataKept(result);
      });
    });

    it('keeps issueIntegrationCfgs entries of providers that are not removed', () => {
      const data = clean();
      slice(data, 'project').entities.P1.issueIntegrationCfgs = {
        JIRA: { isEnabled: true },
        PLAINSPACE: { isEnabled: true },
      };
      const result = stripRemovedFeatureData(data);
      expect(slice(result, 'project').entities.P1.issueIntegrationCfgs).toEqual({
        PLAINSPACE: { isEnabled: true },
      });
    });
  });

  describe('features', () => {
    const configSections: [string, string][] = [
      ['Pomodoro', 'pomodoro'],
      ['Flowtime', 'flowtime'],
      ['Focus Mode', 'focusMode'],
      ['Break Reminders', 'takeABreak'],
      ['Anti-Procrastination', 'dominaMode'],
    ];
    configSections.forEach(([name, section]) => {
      it(`resets the ${name} config (${section}) to its defaults`, () => {
        const data = clean();
        cfg(data)[section] = { ...cfg(data)[section], customValue: 42 };
        const result = stripRemovedFeatureData(data);
        expect(cfg(result)[section]).toEqual(
          (DEFAULT_GLOBAL_CONFIG as unknown as Record<string, Rec>)[section],
        );
        expectCoreDataKept(result);
      });
    });

    it('drops Countdown keys that are no longer part of the config', () => {
      const data = clean();
      cfg(data).countdown = { isEnabled: true };
      const result = stripRemovedFeatureData(data);
      expect('countdown' in cfg(result)).toBe(false);
      expect(result.globalConfig).toEqual(clean().globalConfig);
      expectCoreDataKept(result);
    });

    it('keeps countdown/focus keys while the default config still has them', () => {
      const data = clean();
      cfg(data).reminder = { ...cfg(data).reminder, isCountdownBannerEnabled: false };
      cfg(data).appFeatures = { ...cfg(data).appFeatures, isFocusModeEnabled: false };
      cfg(data).misc = { ...cfg(data).misc, isTrayShowCurrentCountdown: false };
      const result = stripRemovedFeatureData(data);
      expect(cfg(result).reminder.isCountdownBannerEnabled).toBe(false);
      expect(cfg(result).appFeatures.isFocusModeEnabled).toBe(false);
      expect(cfg(result).misc.isTrayShowCurrentCountdown).toBe(false);
    });

    it('drops Daily Planner data (planner days)', () => {
      const data = clean();
      data.planner = { days: { '2026-11-03': ['t3'] }, addPlannedTasksDialogLastShown: 'x' };
      data.dailyPlanner = { foo: 1 };
      const result = stripRemovedFeatureData(data);
      expect(result.planner).toEqual({
        days: {},
        addPlannedTasksDialogLastShown: undefined,
      });
      expect('dailyPlanner' in result).toBe(false);
      expectCoreDataKept(result);
    });

    it('drops Personal Metrics data (metric, improvement, obstruction)', () => {
      const data = clean();
      data.metric = { ids: ['d'], entities: { d: { id: 'd', mood: 3 } } };
      data.improvement = { ids: [], entities: {} };
      data.obstruction = { ids: [], entities: {} };
      const result = stripRemovedFeatureData(data);
      expect(result.metric).toEqual({ ids: [], entities: {} });
      expect('improvement' in result).toBe(false);
      expect('obstruction' in result).toBe(false);
      expectCoreDataKept(result);
    });

    it('drops Calendar Integration data and keeps calendar-imported tasks', () => {
      const data = clean();
      data.calendarIntegration = { calendarProviders: [{ id: 'c' }] };
      cfg(data).calendarIntegration = { calendarProviders: [] };
      (data.task as Rec).dismissedCalendarAutoImportEventIdsByProvider = { c: ['ev'] };
      linkTask(data, 't3', 'ICAL');
      slice(data, 'project').entities.P1.issueIntegrationCfgs = {
        CALENDAR: { isEnabled: true },
      };
      const result = stripRemovedFeatureData(data);
      expect('calendarIntegration' in result).toBe(false);
      expect('calendarIntegration' in cfg(result)).toBe(false);
      expect(
        'dismissedCalendarAutoImportEventIdsByProvider' in (result.task as Rec),
      ).toBe(false);
      expect(result.task).toEqual(clean().task);
      expectCoreDataKept(result);
    });
  });

  describe('old data with all removed features', () => {
    it('keeps every task, subtask, archived task, project, tag and time entry', () => {
      const result = stripRemovedFeatureData(createOldAppDataWithRemovedFeatures());
      expectCoreDataKept(result);
      const tasks = slice(result, 'task').entities;
      expect(tasks.t1.timeEntries).toEqual(slice(clean(), 'task').entities.t1.timeEntries);
      expect(tasks.t1.timeSpentOnDay).toEqual(
        slice(clean(), 'task').entities.t1.timeSpentOnDay,
      );
      expect(tasks.t1sub.parentId).toBe('t1');
    });

    it('returns exactly the clean data', () => {
      expect(stripRemovedFeatureData(createOldAppDataWithRemovedFeatures())).toEqual(
        clean(),
      );
    });

    it('is idempotent', () => {
      const once = stripRemovedFeatureData(createOldAppDataWithRemovedFeatures());
      const twice = stripRemovedFeatureData(once);
      expect(twice).toBe(once);
      expect(twice).toEqual(once);
    });

    it('does not mutate its input', () => {
      const input = createOldAppDataWithRemovedFeatures();
      const copy = structuredClone(input);
      stripRemovedFeatureData(input);
      expect(input).toEqual(copy);
    });
  });

  describe('data without removed-feature keys', () => {
    it('returns the same object unchanged', () => {
      const data = clean();
      const copy = structuredClone(data);
      const result = stripRemovedFeatureData(data);
      expect(result).toBe(data);
      expect(result).toEqual(copy);
    });

    it('returns the same object when the slices are missing', () => {
      const data: Rec = { task: { ids: [], entities: {} } };
      expect(stripRemovedFeatureData(data)).toBe(data);
    });
  });

  describe('isRemovedFeatureDataPath()', () => {
    it('matches removed slices, config sections and issue fields', () => {
      expect(isRemovedFeatureDataPath('$input.issueProvider.entities["x"].id')).toBe(
        true,
      );
      expect(isRemovedFeatureDataPath('$input.metric.ids[0]')).toBe(true);
      expect(isRemovedFeatureDataPath('$input.planner.days')).toBe(true);
      expect(isRemovedFeatureDataPath('$input.globalConfig.pomodoro.duration')).toBe(
        true,
      );
      expect(
        isRemovedFeatureDataPath('$input.task.entities["t1"].issueAttachmentNr'),
      ).toBe(true);
    });

    it('does not match core data', () => {
      expect(isRemovedFeatureDataPath('$input.task.entities["t1"].timeSpent')).toBe(
        false,
      );
      expect(isRemovedFeatureDataPath('$input.globalConfig.misc.isDarkMode')).toBe(
        false,
      );
      expect(isRemovedFeatureDataPath('$input.plannerX')).toBe(false);
    });
  });
});
