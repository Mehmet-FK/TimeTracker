import { BuiltInIssueProviderKey } from '../issue.model';
import {
  IssueFieldType,
  IssueFieldConfig,
  IssueCommentConfig,
  IssueContentConfig,
} from './issue-content.model';
// Gitea is now a plugin — content config lives in the plugin's issueDisplay
// Redmine is now a plugin — content config lives in the plugin's issueDisplay
// Trello is now a plugin — content config lives in the plugin's issueDisplay
// Linear is now a plugin — content config lives in the plugin's issueDisplay
// Azure DevOps is now a plugin — content config lives in the plugin's issueDisplay
// Nextcloud Deck is now a plugin — content config lives in the plugin's issueDisplay
import { PLAINSPACE_ISSUE_CONTENT_CONFIG } from '../providers/plainspace/plainspace-issue-content.const';

// Re-export types for backwards compatibility
export { IssueFieldType, IssueFieldConfig, IssueCommentConfig, IssueContentConfig };

export const ISSUE_CONTENT_CONFIGS: Record<
  BuiltInIssueProviderKey,
  IssueContentConfig<any>
> = {
  PLAINSPACE: PLAINSPACE_ISSUE_CONTENT_CONFIG,
  ICAL: {
    issueType: 'ICAL',
    fields: [],
  },
};
