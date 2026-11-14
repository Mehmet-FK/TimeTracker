import { SearchResultItem } from '../issue.model';

const ISSUE_DONE_STATE_NAME_GUESSES = ['closed', 'done', 'completed', 'resolved'];

export const isIssueDone = (searchResultItem: SearchResultItem): boolean => {
  // Handle plugin providers and migrated providers (e.g. 'GITHUB')
  // PluginIssue uses 'state', PluginSearchResult uses 'status'
  const issueData = searchResultItem.issueData as {
    state?: string;
    status?: string;
  };
  const stateOrStatus = issueData?.state ?? issueData?.status;
  if (typeof stateOrStatus === 'string') {
    return ISSUE_DONE_STATE_NAME_GUESSES.includes(stateOrStatus.toLowerCase());
  }
  return false;
};
