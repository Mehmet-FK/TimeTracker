import {
  issueProviderReducer,
  issueProviderInitialState,
} from './issue-provider.reducer';
import { loadAllData } from '../../../root-store/meta/load-all-data.action';
import { AppDataComplete } from '../../../op-log/model/model-config';
import { IssueProviderState } from '../issue.model';

const loadWith = (entities: Record<string, unknown>): ReturnType<typeof loadAllData> =>
  loadAllData({
    appDataComplete: {
      issueProvider: {
        ids: Object.keys(entities),
        entities,
      } as unknown as IssueProviderState,
    } as AppDataComplete,
  });

describe('issueProviderReducer loadAllData migration', () => {
  describe('AZURE_DEVOPS → azure-devops-issue-provider', () => {
    const legacyAzure = {
      id: 'ap1',
      issueProviderKey: 'AZURE_DEVOPS',
      isEnabled: true,
      host: 'https://dev.azure.com/my-org',
      token: 'azure_pat',
      organization: 'my-org',
      project: 'My Project',
      scope: 'created-by-me',
      autoImportLimit: 100,
    };

    it('moves connection fields into pluginConfig and sets pluginId', () => {
      const state = issueProviderReducer(
        issueProviderInitialState,
        loadWith({ ap1: legacyAzure }),
      );
      const migrated = state.entities['ap1'] as unknown as Record<string, unknown>;
      expect(migrated['pluginId']).toBe('azure-devops-issue-provider');
      expect(migrated['pluginConfig']).toEqual({
        project: 'My Project',
        host: 'https://dev.azure.com/my-org',
        token: 'azure_pat',
        organization: 'my-org',
        scope: 'created-by-me',
        autoImportLimit: 100,
      });
    });

    it('preserves legacy top-level fields for older clients', () => {
      const state = issueProviderReducer(
        issueProviderInitialState,
        loadWith({ ap1: legacyAzure }),
      );
      const migrated = state.entities['ap1'] as unknown as Record<string, unknown>;
      expect(migrated['host']).toBe('https://dev.azure.com/my-org');
      expect(migrated['project']).toBe('My Project');
      expect(migrated['issueProviderKey']).toBe('AZURE_DEVOPS');
    });

    it('defaults optional scope/limit/org fields', () => {
      const state = issueProviderReducer(
        issueProviderInitialState,
        loadWith({
          ap1: {
            id: 'ap1',
            issueProviderKey: 'AZURE_DEVOPS',
            host: 'https://dev.azure.com/o',
            project: 'P',
            token: 't',
          },
        }),
      );
      const cfg = (state.entities['ap1'] as unknown as Record<string, unknown>)[
        'pluginConfig'
      ] as Record<string, unknown>;
      expect(cfg).toEqual({
        project: 'P',
        host: 'https://dev.azure.com/o',
        token: 't',
        organization: '',
        scope: 'assigned-to-me',
        autoImportLimit: 50,
      });
    });

    it('is idempotent — already-migrated providers are left untouched', () => {
      const already = {
        ...legacyAzure,
        pluginId: 'azure-devops-issue-provider',
        pluginConfig: { project: 'P', host: 'h', token: 't' },
      };
      const state = issueProviderReducer(
        issueProviderInitialState,
        loadWith({ ap1: already }),
      );
      expect(state.entities['ap1'] as unknown).toBe(already);
    });
  });

  describe('REDMINE → redmine-issue-provider', () => {
    const legacyRedmine = {
      id: 'rp1',
      issueProviderKey: 'REDMINE',
      isEnabled: true,
      host: 'https://redmine.example.com',
      api_key: 'key',
      projectId: 'proj',
      scope: 'created-by-me',
      isShowTimeTrackingDialog: true,
      isShowTimeTrackingDialogForEachSubTask: true,
      timeTrackingDialogDefaultTime: 'TimeToday',
    };
    const migrate = (provider: unknown): Record<string, unknown> =>
      issueProviderReducer(issueProviderInitialState, loadWith({ rp1: provider }))
        .entities['rp1'] as unknown as Record<string, unknown>;

    it('moves connection and time tracking fields into pluginConfig', () => {
      const migrated = migrate(legacyRedmine);
      expect(migrated['pluginId']).toBe('redmine-issue-provider');
      expect(migrated['pluginConfig']).toEqual({
        projectId: 'proj',
        host: 'https://redmine.example.com',
        api_key: 'key',
        scope: 'created-by-me',
        isShowTimeTrackingDialog: true,
        isShowTimeTrackingDialogForEachSubTask: true,
        timeTrackingDialogDefaultTime: 'TimeToday',
      });
      expect(migrated['host']).toBe('https://redmine.example.com');
    });

    it('defaults missing optional fields', () => {
      const migrated = migrate({ id: 'rp1', issueProviderKey: 'REDMINE', host: 'h' });
      expect(migrated['pluginConfig']).toEqual({
        projectId: '',
        host: 'h',
        api_key: '',
        scope: 'all',
        isShowTimeTrackingDialog: false,
        isShowTimeTrackingDialogForEachSubTask: false,
      });
    });
  });

  describe('NEXTCLOUD_DECK → nextcloud-deck-issue-provider', () => {
    const legacyDeck = {
      id: 'np1',
      issueProviderKey: 'NEXTCLOUD_DECK',
      isEnabled: true,
      nextcloudBaseUrl: 'https://cloud.example.com',
      username: 'me',
      password: 'pw',
      selectedBoardId: 7,
      selectedBoardTitle: 'Board',
      importStackIds: [1, 2],
      doneStackId: 3,
      isTransitionIssuesEnabled: true,
      filterByAssignee: false,
      titleTemplate: '{TITLE}',
      pollIntervalMinutes: 10,
    };
    const migrate = (provider: unknown): Record<string, unknown> =>
      issueProviderReducer(issueProviderInitialState, loadWith({ np1: provider }))
        .entities['np1'] as unknown as Record<string, unknown>;

    it('moves fields into pluginConfig with string ids and done-state push', () => {
      const migrated = migrate(legacyDeck);
      expect(migrated['pluginId']).toBe('nextcloud-deck-issue-provider');
      expect(migrated['pluginConfig']).toEqual({
        selectedBoardTitle: 'Board',
        nextcloudBaseUrl: 'https://cloud.example.com',
        username: 'me',
        password: 'pw',
        selectedBoardId: '7',
        importStackIds: ['1', '2'],
        doneStackId: '3',
        filterByAssignee: false,
        titleTemplate: '{TITLE}',
        twoWaySync: { isDone: 'both', notes: 'pullOnly' },
      });
      expect(migrated['selectedBoardId']).toBe(7);
    });

    it('keeps the legacy defaults for unset fields', () => {
      const migrated = migrate({ id: 'np1', issueProviderKey: 'NEXTCLOUD_DECK' });
      expect(migrated['pluginConfig']).toEqual(
        jasmine.objectContaining({
          selectedBoardId: '',
          importStackIds: [],
          doneStackId: '',
          filterByAssignee: true,
          twoWaySync: { isDone: 'pullOnly', notes: 'pullOnly' },
        }),
      );
    });

    it('is idempotent — already-migrated providers are left untouched', () => {
      const already = { ...legacyDeck, pluginId: 'x', pluginConfig: {} };
      const state = issueProviderReducer(
        issueProviderInitialState,
        loadWith({ np1: already }),
      );
      expect(state.entities['np1'] as unknown).toBe(already);
    });
  });

  it('returns state unchanged when no legacy providers need migration', () => {
    const action = loadWith({
      jp1: { id: 'jp1', issueProviderKey: 'PLAINSPACE', isEnabled: true },
    });
    const state = issueProviderReducer(issueProviderInitialState, action);
    expect(state.entities['jp1']).toEqual(
      jasmine.objectContaining({ issueProviderKey: 'PLAINSPACE' }),
    );
    expect(
      (state.entities['jp1'] as unknown as Record<string, unknown>)['pluginConfig'],
    ).toBeUndefined();
  });
});
