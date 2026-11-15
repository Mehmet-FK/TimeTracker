import { BuiltInIssueProviderKey } from '../issue.model';
import {
  IssueFieldType,
  IssueFieldConfig,
  IssueCommentConfig,
  IssueContentConfig,
} from './issue-content.model';
import { PLAINSPACE_ISSUE_CONTENT_CONFIG } from '../providers/plainspace/plainspace-issue-content.const';

// Re-export types for backwards compatibility
export { IssueFieldType, IssueFieldConfig, IssueCommentConfig, IssueContentConfig };

export const ISSUE_CONTENT_CONFIGS: Record<
  BuiltInIssueProviderKey,
  IssueContentConfig<any>
> = {
  PLAINSPACE: PLAINSPACE_ISSUE_CONTENT_CONFIG,
};
