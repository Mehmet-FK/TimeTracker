import { createAppDataCompleteMock } from '../../../util/app-data-mock';
import { AppDataComplete } from '../../model/model-config';
import { DEFAULT_TASK, TaskCopy } from '../../../features/tasks/task.model';
import { DEFAULT_PROJECT, INBOX_PROJECT } from '../../../features/project/project.const';
import { DEFAULT_TAG } from '../../../features/tag/tag.const';
import { DEFAULT_GLOBAL_CONFIG } from '../../../features/config/default-global-config.const';

/**
 * Data as saved by an older version that still used the removed features and
 * issue providers (TT-35). Shared by the strip/data-repair/guard specs.
 * Built with plain records so it stays valid input after the feature types go.
 */

const HOUR = 60 * 60 * 1000;
const DAY1 = '2026-11-02';
const DAY2 = '2026-11-03';
const D1 = new Date(2026, 10, 2, 9, 0).getTime();
const D2 = new Date(2026, 10, 3, 9, 0).getTime();

export const REMOVED_PROVIDER_TYPES = [
  'JIRA',
  'GITHUB',
  'GITLAB',
  'TRELLO',
  'LINEAR',
  'AZURE_DEVOPS',
  'OPEN_PROJECT',
  'GITEA',
  'CLICKUP',
  'REDMINE',
  'NEXTCLOUD_DECK',
  'CALDAV',
  'ICAL',
] as const;

export const issueFieldsFor = (type: string, nr: number): Record<string, unknown> => ({
  issueId: `${type}-${nr}`,
  issueProviderId: `ip-${type}`,
  issueType: type,
  issueWasUpdated: false,
  issueLastUpdated: D1,
  issueAttachmentNr: 1,
  issueTimeTracked: { [DAY1]: HOUR },
  issuePoints: 3,
  issueLastSyncedValues: { title: 'remote' },
});

const task = (t: Partial<TaskCopy> & { id: string; projectId: string }): TaskCopy => ({
  ...DEFAULT_TASK,
  created: D1,
  title: `Task ${t.id}`,
  ...t,
});

/** Tasks without any removed-feature fields: what must survive. */
export const createCleanTaskFixture = (): {
  active: TaskCopy[];
  archivedYoung: TaskCopy[];
  archivedOld: TaskCopy[];
} => ({
  active: [
    task({
      id: 't1',
      projectId: 'P1',
      tagIds: ['TG1'],
      subTaskIds: ['t1sub'],
      notes: 'parent notes',
      timeSpent: 3 * HOUR,
      timeEstimate: 4 * HOUR,
      timeSpentOnDay: { [DAY1]: 2 * HOUR, [DAY2]: HOUR },
      timeEntries: [
        { id: 'e1', start: D1, end: D1 + HOUR },
        {
          id: 'e2',
          start: D1 + 2 * HOUR,
          end: D1 + 3 * HOUR,
          note: 'review',
          tagIds: ['TG1'],
        },
        { id: 'e3', start: D2, end: D2 + HOUR, fields: { activity: 'dev' } },
      ],
    }),
    task({
      id: 't1sub',
      projectId: 'P1',
      parentId: 't1',
      timeSpent: HOUR,
      timeSpentOnDay: { [DAY2]: HOUR },
      timeEntries: [{ id: 'e4', start: D2 + HOUR, end: D2 + 2 * HOUR }],
    }),
    task({
      id: 't2',
      projectId: INBOX_PROJECT.id,
      isDone: true,
      doneOn: D2,
      timeSpent: 30 * 60 * 1000,
      timeSpentOnDay: { [DAY2]: 30 * 60 * 1000 },
      timeEntries: [{ id: 'e5', start: D2, end: D2 + 30 * 60 * 1000 }],
    }),
    task({ id: 't3', projectId: 'P1', tagIds: ['TG1'] }),
  ],
  archivedYoung: [
    task({
      id: 'a1',
      projectId: 'P1',
      isDone: true,
      doneOn: D1,
      subTaskIds: ['a1sub'],
      timeSpent: HOUR,
      timeSpentOnDay: { [DAY1]: HOUR },
      timeEntries: [{ id: 'e6', start: D1, end: D1 + HOUR }],
    }),
    task({ id: 'a1sub', projectId: 'P1', parentId: 'a1', isDone: true }),
  ],
  archivedOld: [
    task({
      id: 'a2',
      projectId: INBOX_PROJECT.id,
      isDone: true,
      timeSpent: 2 * HOUR,
      timeSpentOnDay: { [DAY1]: 2 * HOUR },
      timeEntries: [
        { id: 'e7', start: D1, end: D1 + HOUR },
        { id: 'e8', start: D1 + HOUR, end: D1 + 2 * HOUR },
      ],
    }),
  ],
});

const toState = <T extends { id: string }>(items: T[]): { ids: string[]; entities: Record<string, T> } => ({
  ids: items.map((i) => i.id),
  entities: Object.fromEntries(items.map((i) => [i.id, i])),
});

/** Which provider each task id was linked to in the old data. */
export const ISSUE_LINKS: Record<string, string> = {
  t1: 'JIRA',
  t1sub: 'GITHUB',
  t3: 'ICAL',
  a1: 'GITEA',
  a1sub: 'TRELLO',
  a2: 'LINEAR',
};

/** Clean app data (no removed-feature keys) with the fixture tasks. */
export const createCleanAppData = (): AppDataComplete => {
  const base = createAppDataCompleteMock();
  const { active, archivedYoung, archivedOld } = createCleanTaskFixture();
  const globalConfig = structuredClone(DEFAULT_GLOBAL_CONFIG);
  // optional countdown key: dropped by the cleanup, so clean data has none
  delete (globalConfig.misc as { isTrayShowCurrentCountdown?: boolean })
    .isTrayShowCurrentCountdown;
  return {
    ...base,
    globalConfig,
    project: toState([
      { ...INBOX_PROJECT, taskIds: ['t2'], backlogTaskIds: [], noteIds: [] },
      {
        ...DEFAULT_PROJECT,
        id: 'P1',
        title: 'Project 1',
        taskIds: ['t1', 't3'],
        backlogTaskIds: [],
        noteIds: [],
      },
    ]) as unknown as AppDataComplete['project'],
    tag: toState([
      { ...DEFAULT_TAG, id: 'TG1', title: 'Tag 1', taskIds: ['t1', 't3'] },
    ]) as unknown as AppDataComplete['tag'],
    task: {
      ...base.task,
      ...toState(active),
    } as unknown as AppDataComplete['task'],
    archiveYoung: {
      ...base.archiveYoung,
      task: toState(archivedYoung) as unknown as AppDataComplete['archiveYoung']['task'],
    },
    archiveOld: {
      ...base.archiveOld,
      task: toState(archivedOld) as unknown as AppDataComplete['archiveOld']['task'],
    },
  };
};

const withIssueFields = (state: unknown): unknown => {
  const s = state as { ids: string[]; entities: Record<string, Record<string, unknown>> };
  const entities = { ...s.entities };
  Object.entries(ISSUE_LINKS).forEach(([id, type], i) => {
    if (entities[id]) entities[id] = { ...entities[id], ...issueFieldsFor(type, i + 1) };
  });
  return { ...s, entities };
};

/**
 * The same data as createCleanAppData(), as an older version saved it: with
 * issue providers, issue-linked tasks, metrics, planner days, and the config
 * of pomodoro, flowtime, focus mode, break reminders, anti-procrastination and
 * countdown, plus legacy calendar/metric keys.
 */
export const createOldAppDataWithRemovedFeatures = (): Record<string, unknown> => {
  const clean = createCleanAppData() as unknown as Record<string, unknown>;
  const project = clean.project as {
    ids: string[];
    entities: Record<string, Record<string, unknown>>;
  };
  const globalConfig = clean.globalConfig as Record<string, Record<string, unknown>>;

  return {
    ...clean,
    issueProvider: toState(
      REMOVED_PROVIDER_TYPES.map((type) => ({
        id: `ip-${type}`,
        issueProviderKey: type,
        isEnabled: true,
        defaultProjectId: 'P1',
        host: 'https://example.invalid',
        token: 'not-a-real-token',
      })),
    ),
    metric: toState([
      { id: DAY1, mood: 4, productivity: 3, obstructions: ['o1'], improvements: [] },
    ]),
    planner: { days: { [DAY2]: ['t3'] }, addPlannedTasksDialogLastShown: DAY1 },
    improvement: { ids: ['i1'], entities: { i1: { id: 'i1', title: 'x' } } },
    obstruction: { ids: [], entities: {} },
    calendarIntegration: { calendarProviders: [{ id: 'cal1' }] },
    project: {
      ...project,
      entities: {
        ...project.entities,
        P1: {
          ...project.entities.P1,
          issueIntegrationCfgs: {
            JIRA: { isEnabled: true, host: 'https://jira.example.invalid' },
            GITLAB: { isEnabled: true, project: 'a/b' },
            CALDAV: { isEnabled: false },
            CALENDAR: { isEnabled: false },
            OPEN_PROJECT: { isEnabled: false },
          },
        },
      },
    },
    task: {
      ...(withIssueFields(clean.task) as Record<string, unknown>),
      dismissedCalendarAutoImportEventIdsByProvider: { 'ip-ICAL': ['ev1'] },
    },
    archiveYoung: {
      ...(clean.archiveYoung as Record<string, unknown>),
      task: withIssueFields((clean.archiveYoung as Record<string, unknown>).task),
    },
    archiveOld: {
      ...(clean.archiveOld as Record<string, unknown>),
      task: withIssueFields((clean.archiveOld as Record<string, unknown>).task),
    },
    globalConfig: {
      ...globalConfig,
      pomodoro: { ...globalConfig.pomodoro, duration: 50 * 60 * 1000 },
      flowtime: { ...globalConfig.flowtime, minDuration: 1, isBreakEnabled: true },
      focusMode: { ...globalConfig.focusMode, isSkipPreparation: true },
      takeABreak: { ...globalConfig.takeABreak, isTakeABreakEnabled: true },
      dominaMode: { ...globalConfig.dominaMode, isEnabled: true, text: 'Work!' },
      misc: { ...globalConfig.misc, isTrayShowCurrentCountdown: false },
      calendarIntegration: { calendarProviders: [] },
    },
  };
};
