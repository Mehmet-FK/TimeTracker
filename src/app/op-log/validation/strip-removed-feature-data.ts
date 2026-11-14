import { DEFAULT_GLOBAL_CONFIG } from '../../features/config/default-global-config.const';

/**
 * Saved-data cleanup for features and issue providers that TimeTracker drops
 * (TT-35): Jira, GitHub, GitLab, Trello, Linear, Azure DevOps, OpenProject,
 * Gitea, ClickUp, Redmine, Nextcloud Deck, CalDAV, calendar integration,
 * focus mode, Pomodoro, Flowtime, countdown, break reminders, daily planner,
 * anti-procrastination and personal metrics.
 *
 * Typed on plain records (no feature types) so it keeps compiling once the
 * features themselves are deleted. Pure: never mutates the input and returns
 * the input object itself when there is nothing to drop. Idempotent.
 *
 * Tasks, projects, tags and time entries are kept; only fields that reference
 * an issue provider (issue* on tasks, removed providers in a project's
 * issueIntegrationCfgs) are removed.
 */

type Rec = Record<string, unknown>;

/** Top-level slices that only hold data of removed features, with their empty state. */
const REMOVED_SLICE_DEFAULTS: Readonly<Record<string, () => unknown>> = {
  issueProvider: () => ({ ids: [], entities: {} }),
  metric: () => ({ ids: [], entities: {} }),
  planner: () => ({ days: {}, addPlannedTasksDialogLastShown: undefined }),
};

/** Top-level keys of removed features that older data may still carry. */
const REMOVED_TOP_LEVEL_KEYS: readonly string[] = [
  // personal metrics (pre-v17 sub-models)
  'improvement',
  'obstruction',
  // calendar integration / daily planner
  'calendarIntegration',
  'dailyPlanner',
];

/** globalConfig sections of removed features: reset to defaults (dropped once removed). */
const REMOVED_CONFIG_SECTIONS: readonly string[] = [
  'pomodoro',
  'flowtime',
  'focusMode',
  'takeABreak',
  'dominaMode',
];

/** globalConfig sections of removed features that are no longer part of the model. */
const DROPPED_CONFIG_SECTIONS: readonly string[] = [
  'calendarIntegration',
  'dailyPlanner',
  'metric',
  'countdown',
];

/**
 * Countdown/focus/planner/break keys inside sections that stay. A key is
 * dropped when it is optional today, or once the default config no longer
 * has it (after the feature is removed). Required keys that still exist are
 * left alone so the user's choice and validation are kept until then.
 */
const REMOVED_CONFIG_KEYS: readonly { section: string; key: string; optional?: true }[] =
  [
    { section: 'misc', key: 'isTrayShowCurrentCountdown', optional: true },
    { section: 'reminder', key: 'isCountdownBannerEnabled' },
    { section: 'reminder', key: 'countdownDuration' },
    { section: 'appFeatures', key: 'isFocusModeEnabled' },
    { section: 'appFeatures', key: 'isPlannerEnabled' },
    { section: 'idle', key: 'isSuppressIdleDuringFocusMode' },
    { section: 'sound', key: 'breakReminderSound' },
  ];

/** Task fields that only reference an issue provider. */
export const ISSUE_TASK_FIELDS: readonly string[] = [
  'issueId',
  'issueProviderId',
  'issueType',
  'issueWasUpdated',
  'issueLastUpdated',
  'issueAttachmentNr',
  'issueTimeTracked',
  'issuePoints',
  'issueLastSyncedValues',
];

/** Calendar-integration keys on the task state itself. */
const REMOVED_TASK_STATE_KEYS: readonly string[] = [
  'dismissedCalendarAutoImportEventIdsByProvider',
];

/** Keys of removed providers (issueIntegrationCfgs, provider maps). */
export const REMOVED_PROVIDER_KEYS: readonly string[] = [
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
  'CALENDAR',
  'ICAL',
];

/** Slices and globalConfig sections that are replaced as a whole (for repair error filtering). */
export const REMOVED_FEATURE_DATA_PATHS: readonly string[] = [
  ...Object.keys(REMOVED_SLICE_DEFAULTS),
  ...REMOVED_TOP_LEVEL_KEYS,
  ...REMOVED_CONFIG_SECTIONS.map((s) => `globalConfig.${s}`),
  ...DROPPED_CONFIG_SECTIONS.map((s) => `globalConfig.${s}`),
];

/**
 * True when a typia error path (e.g. "$input.issueProvider.entities.x") points
 * into data that stripRemovedFeatureData replaces or drops.
 */
export const isRemovedFeatureDataPath = (path: string): boolean => {
  const p = path.startsWith('$input.') ? path.slice('$input.'.length) : path;
  if (
    REMOVED_FEATURE_DATA_PATHS.some(
      (r) => p === r || p.startsWith(r + '.') || p.startsWith(r + '['),
    )
  ) {
    return true;
  }
  // issue* fields of tasks and the issueIntegrationCfgs of projects
  const segments = p.split(/[.[\]"]+/).filter(Boolean);
  return segments.some(
    (s) =>
      s === 'issueIntegrationCfgs' ||
      ISSUE_TASK_FIELDS.includes(s) ||
      REMOVED_TASK_STATE_KEYS.includes(s),
  );
};

const isRec = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Structural equality for JSON-like data; keys holding undefined count as missing. */
const isSameData = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => isSameData(v, b[i]))
    );
  }
  if (!isRec(a) || !isRec(b)) return false;
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => isSameData(a[k], b[k]));
};

const without = (obj: Rec, keys: readonly string[]): Rec => {
  const out: Rec = { ...obj };
  for (const k of keys) delete out[k];
  return out;
};

const hasAnyKey = (obj: Rec, keys: readonly string[]): boolean =>
  keys.some((k) => k in obj);

/** Removes issue* fields from every task of an entity state; same object if none. */
const stripTaskState = (state: unknown): unknown => {
  if (!isRec(state) || !isRec(state.entities)) return state;
  let entities: Rec | undefined;
  for (const [id, task] of Object.entries(state.entities)) {
    if (isRec(task) && hasAnyKey(task, ISSUE_TASK_FIELDS)) {
      entities = entities ?? { ...state.entities };
      entities[id] = without(task, ISSUE_TASK_FIELDS);
    }
  }
  if (!entities && !hasAnyKey(state, REMOVED_TASK_STATE_KEYS)) return state;
  const out = without(state, REMOVED_TASK_STATE_KEYS);
  return entities ? { ...out, entities } : out;
};

const stripArchive = (archive: unknown): unknown => {
  if (!isRec(archive)) return archive;
  const task = stripTaskState(archive.task);
  return task === archive.task ? archive : { ...archive, task };
};

/** Removes removed providers from each project's issueIntegrationCfgs. */
const stripProjectState = (state: unknown): unknown => {
  if (!isRec(state) || !isRec(state.entities)) return state;
  let entities: Rec | undefined;
  for (const [id, project] of Object.entries(state.entities)) {
    if (!isRec(project) || !('issueIntegrationCfgs' in project)) continue;
    const cfgs = project.issueIntegrationCfgs;
    if (isRec(cfgs) && !hasAnyKey(cfgs, REMOVED_PROVIDER_KEYS)) continue;
    const rest = isRec(cfgs) ? without(cfgs, REMOVED_PROVIDER_KEYS) : {};
    entities = entities ?? { ...state.entities };
    entities[id] =
      Object.keys(rest).length > 0
        ? { ...project, issueIntegrationCfgs: rest }
        : without(project, ['issueIntegrationCfgs']);
  }
  return entities ? { ...state, entities } : state;
};

const stripGlobalConfig = (cfg: unknown): unknown => {
  if (!isRec(cfg)) return cfg;
  const defaults = DEFAULT_GLOBAL_CONFIG as unknown as Rec;
  let out: Rec | undefined;
  const set = (key: string, value: unknown): void => {
    out = out ?? { ...cfg };
    if (value === undefined) {
      delete out[key];
    } else {
      out[key] = value;
    }
  };

  for (const section of REMOVED_CONFIG_SECTIONS) {
    if (!(section in cfg)) continue;
    const def = defaults[section];
    if (def === undefined) {
      set(section, undefined);
    } else if (!isSameData(cfg[section], def)) {
      set(section, structuredClone(def));
    }
  }
  for (const section of DROPPED_CONFIG_SECTIONS) {
    if (section in cfg && !(section in defaults)) set(section, undefined);
  }
  for (const { section, key, optional } of REMOVED_CONFIG_KEYS) {
    const current = (out ?? cfg)[section];
    const defSection = defaults[section];
    const isGone = !isRec(defSection) || !(key in defSection);
    if (isRec(current) && key in current && (optional || isGone)) {
      set(section, without(current, [key]));
    }
  }
  return out ?? cfg;
};

export const stripRemovedFeatureData = <T extends Rec>(data: T): T => {
  if (!isRec(data)) return data;
  let out: Rec | undefined;
  const set = (key: string, value: unknown): void => {
    out = out ?? { ...data };
    out[key] = value;
  };

  for (const [key, makeDefault] of Object.entries(REMOVED_SLICE_DEFAULTS)) {
    if (!(key in data)) continue;
    const def = makeDefault();
    if (!isSameData(data[key], def)) set(key, def);
  }
  for (const key of REMOVED_TOP_LEVEL_KEYS) {
    if (key in data) {
      out = out ?? { ...data };
      delete out[key];
    }
  }

  const globalConfig = stripGlobalConfig(data.globalConfig);
  if (globalConfig !== data.globalConfig) set('globalConfig', globalConfig);

  const task = stripTaskState(data.task);
  if (task !== data.task) set('task', task);
  for (const key of ['archiveYoung', 'archiveOld']) {
    const archive = stripArchive(data[key]);
    if (archive !== data[key]) set(key, archive);
  }

  const project = stripProjectState(data.project);
  if (project !== data.project) set('project', project);

  return (out ?? data) as T;
};
