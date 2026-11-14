import { IssueProviderKey } from '../issue.model';

export const getIssueProviderHelpLink = (
  issueProviderKey: IssueProviderKey,
): string | undefined => {
  switch (issueProviderKey) {
    case 'GITHUB':
      return 'https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests';
    // case 'GITEA':
    // case 'REDMINE':
  }
  return undefined;
};
