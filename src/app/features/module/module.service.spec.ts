import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { ModuleHasTasksError, ModuleService } from './module.service';
import { selectAllTasks } from '../tasks/store/task.selectors';
import { Task } from '../tasks/task.model';
import { GENERAL_MODULE, GENERAL_MODULE_ID } from './module.const';
import { selectAllModules } from './store/module.reducer';
import { addModule, deleteModule, updateModule } from './store/module.actions';

describe('ModuleService', () => {
  let service: ModuleService;
  let store: MockStore;
  let dispatchSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ModuleService, provideMockStore()],
    });
    store = TestBed.inject(MockStore);
    store.overrideSelector(selectAllTasks, []);
    store.overrideSelector(selectAllModules, [GENERAL_MODULE, { id: 'm1', name: 'One' }]);
    store.refreshState();
    dispatchSpy = spyOn(store, 'dispatch');
    service = TestBed.inject(ModuleService);
  });

  it('lists modules', () => {
    expect(service.modules().map((m) => m.id)).toEqual([GENERAL_MODULE_ID, 'm1']);
  });

  it('creates a module with a generated id', () => {
    const id = service.add({ name: 'New', iconUrl: 'https://example.com/i.png' });
    expect(id).toBeTruthy();
    expect(dispatchSpy).toHaveBeenCalledWith(
      addModule({ module: { id, name: 'New', iconUrl: 'https://example.com/i.png' } }),
    );
  });

  it('rejects an empty name or an invalid icon url on create', () => {
    expect(() => service.add({ name: '' })).toThrowError(/NAME_REQUIRED/);
    expect(() => service.add({ name: 'A', iconUrl: 'nope' })).toThrowError(
      /ICON_URL_INVALID/,
    );
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('updates a module', () => {
    service.update('m1', { name: 'Uno' });
    expect(dispatchSpy).toHaveBeenCalledWith(
      updateModule({ module: { id: 'm1', changes: { name: 'Uno' } } }),
    );
  });

  it('rejects an invalid update', () => {
    expect(() => service.update('m1', { name: ' ' })).toThrowError(/NAME_REQUIRED/);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('deletes a module without linked tasks', () => {
    service.delete('m1');
    expect(dispatchSpy).toHaveBeenCalledWith(deleteModule({ id: 'm1' }));
  });

  it('refuses to delete a module with linked tasks and reports the count', () => {
    const tasks = [
      { id: 't1', moduleIds: ['m1'] },
      { id: 't2', moduleIds: ['m1', GENERAL_MODULE_ID] },
      { id: 't3', moduleIds: [GENERAL_MODULE_ID] },
    ] as Task[];
    store.overrideSelector(selectAllTasks, tasks);
    store.refreshState();

    let error: unknown;
    try {
      service.delete('m1');
    } catch (e) {
      error = e;
    }
    expect(error instanceof ModuleHasTasksError).toBeTrue();
    expect((error as ModuleHasTasksError).count).toBe(2);
    expect((error as ModuleHasTasksError).moduleId).toBe('m1');
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(service.modules().map((m) => m.id)).toContain('m1');
    expect(tasks.length).toBe(3);
  });

  it('rejects editing GENERAL', () => {
    expect(() => service.update(GENERAL_MODULE_ID, { name: 'X' })).toThrowError(
      /GENERAL/,
    );
    expect(() => service.update(GENERAL_MODULE_ID, { description: 'X' })).toThrowError(
      /GENERAL/,
    );
    expect(() =>
      service.update(GENERAL_MODULE_ID, { iconUrl: 'https://example.com/i.png' }),
    ).toThrowError(/GENERAL/);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('rejects deleting GENERAL', () => {
    expect(() => service.delete(GENERAL_MODULE_ID)).toThrowError(/GENERAL/);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
