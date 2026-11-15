import { IssueProvider } from '../issue.model';
import {
  getIssueProviderInitials,
  getIssueProviderTooltip,
} from './get-issue-provider-tooltip';

describe('plugin provider display name', () => {
  const pluginProvider = (pluginConfig: Record<string, unknown>): IssueProvider =>
    ({
      id: 'ip-1',
      issueProviderKey: 'plugin:test',
      pluginId: 'test',
      pluginConfig,
    }) as unknown as IssueProvider;

  it('shows the first non-secret config value as tooltip', () => {
    expect(
      getIssueProviderTooltip(pluginProvider({ token: 'SECRET', repo: 'owner/my-repo' })),
    ).toBe('owner/my-repo');
  });

  it('falls back to the provider key when no safe value is set', () => {
    expect(getIssueProviderTooltip(pluginProvider({ token: 'SECRET' }))).toBe(
      'plugin:test',
    );
  });

  it('derives initials from the repo name', () => {
    expect(getIssueProviderInitials(pluginProvider({ repo: 'owner/my-repo' }))).toBe(
      'MR',
    );
  });
});
