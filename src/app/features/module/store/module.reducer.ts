import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { createFeatureSelector, createReducer, createSelector, on } from '@ngrx/store';
import { Module, ModuleState } from '../module.model';
import { GENERAL_MODULE_ID } from '../module.const';
import { addModule, deleteModule, updateModule } from './module.actions';

export const MODULE_FEATURE_NAME = 'module';

export const moduleAdapter: EntityAdapter<Module> = createEntityAdapter<Module>();
export const selectModuleFeatureState =
  createFeatureSelector<ModuleState>(MODULE_FEATURE_NAME);
export const { selectAll, selectEntities } = moduleAdapter.getSelectors();
export const selectAllModules = createSelector(selectModuleFeatureState, selectAll);
export const selectModuleEntities = createSelector(
  selectModuleFeatureState,
  selectEntities,
);

export const initialModuleState: ModuleState = moduleAdapter.getInitialState();

export const moduleReducer = createReducer<ModuleState>(
  initialModuleState,
  on(addModule, (state, { module }) => moduleAdapter.addOne(module, state)),
  on(updateModule, (state, { module }) => {
    if (module.id === GENERAL_MODULE_ID) {
      throw new Error('The GENERAL module cannot be changed');
    }
    return moduleAdapter.updateOne(module, state);
  }),
  on(deleteModule, (state, { id }) => {
    if (id === GENERAL_MODULE_ID) {
      throw new Error('The GENERAL module cannot be deleted');
    }
    return moduleAdapter.removeOne(id, state);
  }),
);
