import { IssueProviderBase, BuiltInIssueProviderKey } from './issue.model';
import { T } from '../../t.const';
import {
  DEFAULT_PLAINSPACE_CFG,
  PLAINSPACE_CONFIG_FORM_SECTION,
} from './providers/plainspace/plainspace.const';

export const DELAY_BEFORE_ISSUE_POLLING = 8000;

export const PLAINSPACE_TYPE: BuiltInIssueProviderKey = 'PLAINSPACE';

export const ISSUE_PROVIDER_TYPES: BuiltInIssueProviderKey[] = [PLAINSPACE_TYPE] as const;

export const ISSUE_PROVIDER_ICON_MAP = {
  [PLAINSPACE_TYPE]: 'plainspace',
} as const;

export const ISSUE_PROVIDER_HUMANIZED = {
  [PLAINSPACE_TYPE]: 'Plainspace',
} as const;

export const DEFAULT_ISSUE_PROVIDER_CFGS = {
  [PLAINSPACE_TYPE]: DEFAULT_PLAINSPACE_CFG,
} as const;

export const ISSUE_PROVIDER_FORM_CFGS_MAP = {
  [PLAINSPACE_TYPE]: PLAINSPACE_CONFIG_FORM_SECTION,
} as const;

export const DEFAULT_ISSUE_STRS: { ISSUE_STR: string; ISSUES_STR: string } = {
  ISSUE_STR: T.F.ISSUE.DEFAULT.ISSUE_STR,
  ISSUES_STR: T.F.ISSUE.DEFAULT.ISSUES_STR,
} as const;

export const ISSUE_STR_MAP: Record<
  BuiltInIssueProviderKey,
  { ISSUE_STR: string; ISSUES_STR: string }
> = {
  [PLAINSPACE_TYPE]: DEFAULT_ISSUE_STRS,
} as const;

export const ISSUE_PROVIDER_DEFAULT_COMMON_CFG: Omit<
  IssueProviderBase,
  'id' | 'issueProviderKey' | 'isEnabled'
> = {
  isAutoPoll: true,
  isAutoAddToBacklog: false,
  isIntegratedAddTaskBar: false,
  defaultProjectId: null,
  pinnedSearch: null,
  pollingMode: 'whenProjectOpen',
  defaultTagIds: [],
  defaultNote: null,
} as const;
