import { IssueProviderKey } from '../issue.model';

export const getIssueProviderHelpLink = (
  issueProviderKey: IssueProviderKey,
): string | undefined => {
  switch (issueProviderKey) {
    case 'GITHUB':
      return 'https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests';
    // NOTE: the GitLab search box hits the Issues API `search=` param (plain
    // substring match), not Advanced Search — so link the issues endpoint, not
    // the advanced-search syntax page (#8884).
    case 'GITLAB':
      return 'https://docs.gitlab.com/api/issues/#list-project-issues';
    // case 'GITEA':
    // case 'REDMINE':
    // case 'OPEN_PROJECT':
  }
  return undefined;
};
