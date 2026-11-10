import { createAction, props } from '@ngrx/store';
import { Update } from '@ngrx/entity';
import { Module } from '../module.model';

export const addModule = createAction('[Module] Add Module', props<{ module: Module }>());

export const updateModule = createAction(
  '[Module] Update Module',
  props<{ module: Update<Module> }>(),
);

export const deleteModule = createAction(
  '[Module] Delete Module',
  props<{ id: string }>(),
);

/** Links every task that has no module to GENERAL (init backfill, idempotent). */
export const linkOrphanTasksToGeneral = createAction('[Module] Link Orphan Tasks');
