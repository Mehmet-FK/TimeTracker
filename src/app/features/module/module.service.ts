import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { nanoid } from 'nanoid';
import { Module } from './module.model';
import { GENERAL_MODULE_ID } from './module.const';
import { validateModule } from './module.validator';
import { selectAllTasks } from '../tasks/store/task.selectors';
import { selectAllModules } from './store/module.reducer';
import { addModule, deleteModule, updateModule } from './store/module.actions';

/** Thrown when a module cannot be deleted because tasks are still linked to it. */
export class ModuleHasTasksError extends Error {
  constructor(
    readonly moduleId: string,
    readonly count: number,
  ) {
    super(`Module ${moduleId} still has ${count} linked task(s)`);
    this.name = 'ModuleHasTasksError';
    Object.setPrototypeOf(this, ModuleHasTasksError.prototype);
  }
}

@Injectable({
  providedIn: 'root',
})
export class ModuleService {
  private readonly _store = inject(Store);
  private readonly _allTasks = this._store.selectSignal(selectAllTasks);

  readonly modules = this._store.selectSignal(selectAllModules);

  /** Creates a module; throws when name or iconUrl is invalid. Returns the id. */
  add(props: Omit<Module, 'id'>): string {
    const errors = validateModule(props);
    if (errors.length) {
      throw new Error(`Invalid module: ${errors.join(', ')}`);
    }
    const id = nanoid();
    this._store.dispatch(addModule({ module: { ...props, id } }));
    return id;
  }

  /** Updates a module; throws for GENERAL or invalid values. */
  update(id: string, changes: Partial<Omit<Module, 'id'>>): void {
    if (id === GENERAL_MODULE_ID) {
      throw new Error('The GENERAL module cannot be changed');
    }
    const current = this.modules().find((m) => m.id === id);
    if (!current) {
      throw new Error('Module not found');
    }
    const errors = validateModule({ ...current, ...changes });
    if (errors.length) {
      throw new Error(`Invalid module: ${errors.join(', ')}`);
    }
    this._store.dispatch(updateModule({ module: { id, changes } }));
  }

  /**
   * Deletes a module; throws for GENERAL and throws ModuleHasTasksError
   * (nothing is dispatched) while tasks are still linked to the module.
   */
  delete(id: string): void {
    if (id === GENERAL_MODULE_ID) {
      throw new Error('The GENERAL module cannot be deleted');
    }
    const count = this._allTasks().filter((t) => t.moduleIds?.includes(id)).length;
    if (count > 0) {
      throw new ModuleHasTasksError(id, count);
    }
    this._store.dispatch(deleteModule({ id }));
  }
}
