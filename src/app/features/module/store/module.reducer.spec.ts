import { GENERAL_MODULE, GENERAL_MODULE_ID } from '../module.const';
import { addModule, deleteModule, updateModule } from './module.actions';
import { initialModuleState, moduleReducer } from './module.reducer';

describe('moduleReducer', () => {
  const withGeneral = (): ReturnType<typeof moduleReducer> =>
    moduleReducer(initialModuleState, addModule({ module: GENERAL_MODULE }));

  it('adds, updates and deletes a regular module', () => {
    let state = moduleReducer(
      withGeneral(),
      addModule({ module: { id: 'm1', name: 'One' } }),
    );
    expect(state.entities['m1']?.name).toBe('One');

    state = moduleReducer(
      state,
      updateModule({ module: { id: 'm1', changes: { name: 'Uno', description: 'd' } } }),
    );
    expect(state.entities['m1']).toEqual({ id: 'm1', name: 'Uno', description: 'd' });

    state = moduleReducer(state, deleteModule({ id: 'm1' }));
    expect(state.entities['m1']).toBeUndefined();
  });

  it('rejects updating GENERAL and leaves it unchanged', () => {
    const state = withGeneral();
    for (const changes of [
      { name: 'X' },
      { description: 'X' },
      { iconUrl: 'https://example.com/a.png' },
    ]) {
      expect(() =>
        moduleReducer(
          state,
          updateModule({ module: { id: GENERAL_MODULE_ID, changes } }),
        ),
      ).toThrowError(/GENERAL/);
    }
    expect(state.entities[GENERAL_MODULE_ID]).toEqual(GENERAL_MODULE);
  });

  it('rejects deleting GENERAL', () => {
    const state = withGeneral();
    expect(() =>
      moduleReducer(state, deleteModule({ id: GENERAL_MODULE_ID })),
    ).toThrowError(/GENERAL/);
    expect(state.entities[GENERAL_MODULE_ID]).toEqual(GENERAL_MODULE);
  });
});
