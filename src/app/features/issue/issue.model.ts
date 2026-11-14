import { EntityState } from '@ngrx/entity';
import {
  CalendarProviderCfg,
  ICalIssue,
  ICalIssueReduced,
} from './providers/calendar/calendar.model';
import { PlainspaceCfg } from './providers/plainspace/plainspace.model';
import { PlainspaceIssue } from './providers/plainspace/plainspace-issue.model';
import {
  PluginIssue,
  PluginSearchResult,
} from '../../plugins/issue-provider/plugin-issue-provider.model';

export interface BaseIssueProviderCfg {
  isEnabled: boolean;
}

// Built-in issue provider keys (strict union for type safety).
// NOTE: adding a key here is forward-compatible for OLDER clients only because
// `isForwardCompatibleProviderKeyError` (op-log/validation/validation-fn.ts) tolerates
// unknown provider-key values during sync validation. Without that, an older build's
// typia validator would treat a synced task/provider using the new key as corruption.
export type BuiltInIssueProviderKey = 'ICAL' | 'PLAINSPACE';

// Plugin issue provider keys use a 'plugin:' prefix to avoid collision
export type PluginIssueProviderKey = `plugin:${string}`;

// Combined type — preserves autocomplete for built-in keys
export type IssueProviderKey = BuiltInIssueProviderKey | PluginIssueProviderKey;

export const isPluginIssueProvider = (
  key: IssueProviderKey,
): key is PluginIssueProviderKey => {
  return typeof key === 'string' && key.startsWith('plugin:');
};

const BUILT_IN_KEYS: ReadonlySet<string> = new Set<BuiltInIssueProviderKey>([
  'ICAL',
  'PLAINSPACE',
]);

export const isValidIssueProviderKey = (key: string): key is IssueProviderKey => {
  return BUILT_IN_KEYS.has(key) || key.startsWith('plugin:');
};

export type IssueIntegrationCfg = CalendarProviderCfg | PlainspaceCfg;

export enum IssueLocalState {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export interface IssueIntegrationCfgs {
  // should be the same as key IssueProviderKey
  CALENDAR?: CalendarProviderCfg;
  PLAINSPACE?: PlainspaceCfg;
}

export type IssueData = ICalIssue | PlainspaceIssue | PluginIssue;

export type IssueDataReduced = ICalIssueReduced | PlainspaceIssue | PluginSearchResult;

export type IssueDataReducedMap = {
  [K in IssueProviderKey]: K extends 'ICAL'
    ? ICalIssueReduced
    : K extends 'PLAINSPACE'
      ? PlainspaceIssue
      : K extends PluginIssueProviderKey
        ? PluginSearchResult
        : never;
};

// TODO: add issue model to the IssueDataReducedMap

export interface SearchResultItem<
  T extends keyof IssueDataReducedMap = keyof IssueDataReducedMap,
> {
  title: string;
  issueType: T;
  issueData: IssueDataReducedMap[T];
  titleHighlighted?: string;
}

export interface SearchResultItemWithProviderId extends SearchResultItem {
  issueProviderId: string;
}

// ISSUE PROVIDER MODEL
// --------------------

export interface IssueProviderState extends EntityState<IssueProvider> {
  ids: string[];
  // additional entities state properties
}

// export type IssueProviderState = EntityState<IssueProvider>;

export type IssueProviderPollingMode = 'whenProjectOpen' | 'always';

export interface IssueProviderBase extends BaseIssueProviderCfg {
  id: string;
  isEnabled: boolean;
  issueProviderKey: IssueProviderKey;
  defaultProjectId?: string | null | false;
  pinnedSearch?: string | null;
  // delete at some point in the future
  migratedFromProjectId?: string;
  isAutoPoll?: boolean;
  isAutoAddToBacklog?: boolean;
  isIntegratedAddTaskBar?: boolean;
  pollingMode?: IssueProviderPollingMode;
  defaultTagIds?: string[];
  defaultNote?: string | null;
}

export interface IssueProviderCalendar extends IssueProviderBase, CalendarProviderCfg {
  issueProviderKey: 'ICAL';
}

export interface IssueProviderPlainspace extends IssueProviderBase, PlainspaceCfg {
  issueProviderKey: 'PLAINSPACE';
}

export interface IssueProviderPluginType extends IssueProviderBase {
  issueProviderKey: PluginIssueProviderKey;
  pluginId: string;
  pluginConfig: Record<string, unknown>;
}

export type IssueProvider =
  | IssueProviderCalendar
  | IssueProviderPlainspace
  | IssueProviderPluginType;

export type IssueProviderTypeMap<T extends IssueProviderKey> = T extends 'ICAL'
  ? IssueProviderCalendar
  : T extends 'PLAINSPACE'
    ? IssueProviderPlainspace
    : T extends PluginIssueProviderKey
      ? IssueProviderPluginType
      : never;
