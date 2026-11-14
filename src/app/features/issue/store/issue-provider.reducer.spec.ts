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

describe('issueProviderReducer loadAllData', () => {
  it('loads PLAINSPACE and plugin providers unchanged', () => {
    const plainspace = { id: 'ps1', issueProviderKey: 'PLAINSPACE', isEnabled: true };
    const plugin = {
      id: 'pp1',
      issueProviderKey: 'plugin:google-calendar-provider',
      isEnabled: true,
      pluginId: 'google-calendar-provider',
      pluginConfig: { calendarId: 'primary' },
    };
    const state = issueProviderReducer(
      issueProviderInitialState,
      loadWith({ ps1: plainspace, pp1: plugin }),
    );
    expect(state.ids).toEqual(['ps1', 'pp1']);
    expect(state.entities['ps1'] as unknown).toBe(plainspace);
    expect(state.entities['pp1'] as unknown).toBe(plugin);
    expect(
      (state.entities['ps1'] as unknown as Record<string, unknown>)['pluginConfig'],
    ).toBeUndefined();
  });

  it('keeps the old state when the loaded data has no issueProvider slice', () => {
    const state = issueProviderReducer(
      issueProviderInitialState,
      loadAllData({ appDataComplete: {} as AppDataComplete }),
    );
    expect(state).toBe(issueProviderInitialState);
  });
});
