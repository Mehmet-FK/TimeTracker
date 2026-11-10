import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import {
  selectAllTasks,
  selectAllTasksInActiveProjects,
} from '../../features/tasks/store/task.selectors';
import { Task } from '../../features/tasks/task.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModulesPageComponent } from './modules-page.component';
import { ModuleService } from '../../features/module/module.service';
import { GENERAL_MODULE, GENERAL_MODULE_ID } from '../../features/module/module.const';
import { Module } from '../../features/module/module.model';

describe('ModulesPageComponent', () => {
  let fixture: ComponentFixture<ModulesPageComponent>;
  let el: HTMLElement;
  let serviceSpy: jasmine.SpyObj<ModuleService>;

  const setInput = (selector: string, value: string): void => {
    const input = el.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  let modules: WritableSignal<Module[]>;
  let tasks: WritableSignal<Partial<Task>[]>;
  let selectorsUsed: unknown[];

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<ModuleService>('ModuleService', [
      'add',
      'update',
      'delete',
    ]);
    modules = signal<Module[]>([
      GENERAL_MODULE,
      { id: 'm1', name: 'One', description: 'Desc one', iconUrl: 'https://x.test/a.png' },
    ]);
    (serviceSpy as any).modules = modules.asReadonly();
    tasks = signal<Partial<Task>[]>([
      { id: 't1', title: 'Task 1', moduleIds: ['m1'] },
      { id: 't2', title: 'Task 2', moduleIds: ['m1', GENERAL_MODULE_ID] },
      { id: 't3', title: 'Task 3' },
    ]);
    selectorsUsed = [];
    const storeStub = {
      selectSignal: (selector: unknown) => {
        selectorsUsed.push(selector);
        return tasks.asReadonly();
      },
      select: () => of([]),
      dispatch: () => undefined,
    };

    await TestBed.configureTestingModule({
      imports: [ModulesPageComponent, TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        { provide: ModuleService, useValue: serviceSpy },
        { provide: Store, useValue: storeStub },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { F: { MODULE: { TASK_COUNT: '{{count}} tasks' } } });
    translate.use('en');

    fixture = TestBed.createComponent(ModulesPageComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const cardOf = (id: string): HTMLElement =>
    el.querySelector(`[data-module-id="${id}"]`) as HTMLElement;

  const buttonsOf = (
    id: string,
  ): { edit: HTMLButtonElement | null; del: HTMLButtonElement | null } => ({
    edit: cardOf(id).querySelector('.module-edit-btn'),
    del: cardOf(id).querySelector('.module-delete-btn'),
  });

  it('renders a card grid instead of a list', () => {
    expect(el.querySelector('.module-grid')).toBeTruthy();
    expect(el.querySelector('ul.module-list')).toBeNull();
    expect(el.querySelectorAll('.module-card').length).toBe(2);
    expect(cardOf('m1').querySelector('.module-title')!.textContent).toContain('One');
    expect(cardOf('m1').querySelector('.module-desc')!.textContent).toContain('Desc one');
  });

  it('counts tasks per module, tasks without moduleIds count for GENERAL', () => {
    const cmp = fixture.componentInstance;
    expect(cmp.taskCount('m1')).toBe(2);
    expect(cmp.taskCount(GENERAL_MODULE_ID)).toBe(2);
  });

  it('counts several modules in one grouping, including a module with 0 tasks', () => {
    modules.update((m) => [...m, { id: 'm2', name: 'Two' }]);
    tasks.update((t) => [...t, { id: 't4', title: 'Task 4', moduleIds: ['m1'] }]);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    expect(cmp.taskCount('m1')).toBe(3);
    expect(cmp.taskCount(GENERAL_MODULE_ID)).toBe(2);
    expect(cmp.taskCount('m2')).toBe(0);
    expect(cmp.taskCount('unknown')).toBe(0);
  });

  it('renders the task count only for modules with tasks', () => {
    modules.update((m) => [...m, { id: 'm2', name: 'Two' }]);
    fixture.detectChanges();
    const countText = (id: string): string | undefined =>
      cardOf(id).querySelector('.module-task-count')?.textContent?.trim();
    expect(countText('m1')).toBe('2 tasks');
    expect(countText(GENERAL_MODULE_ID)).toBe('2 tasks');
    expect(cardOf('m2').querySelector('.module-task-count')).toBeNull();
  });

  it('removes the count element when the last task of a module is gone', () => {
    tasks.set([{ id: 't3', title: 'Task 3' }]);
    fixture.detectChanges();
    expect(cardOf('m1').querySelector('.module-task-count')).toBeNull();
    expect(cardOf(GENERAL_MODULE_ID).querySelector('.module-task-count')).toBeTruthy();
  });

  describe('unused badge', () => {
    const badge = (id: string): Element | null =>
      cardOf(id).querySelector('.module-unused-badge');

    it('shows the badge for a module without tasks and not for linked modules', () => {
      modules.update((m) => [...m, { id: 'm2', name: 'Two' }]);
      fixture.detectChanges();
      expect(badge('m2')).toBeTruthy();
      expect(badge('m2')!.textContent!.trim()).toBe('F.MODULE.UNUSED_BADGE');
      expect(badge('m1')).toBeNull();
      expect(badge(GENERAL_MODULE_ID)).toBeNull();
    });

    it('shows the badge once the last task is removed', () => {
      expect(badge('m1')).toBeNull();
      tasks.set([{ id: 't3', title: 'Task 3' }]);
      fixture.detectChanges();
      expect(badge('m1')).toBeTruthy();
    });

    it('moves the badge when the last task moves to another module', () => {
      modules.update((m) => [...m, { id: 'm2', name: 'Two' }]);
      tasks.set([
        { id: 't1', title: 'Task 1', moduleIds: ['m1'] },
        { id: 't3', title: 'T3' },
      ]);
      fixture.detectChanges();
      expect(badge('m1')).toBeNull();
      expect(badge('m2')).toBeTruthy();

      tasks.set([
        { id: 't1', title: 'Task 1', moduleIds: ['m2'] },
        { id: 't3', title: 'T3' },
      ]);
      fixture.detectChanges();
      expect(badge('m1')).toBeTruthy();
      expect(badge('m2')).toBeNull();
    });
  });

  it('reads tasks from the active-projects selector (excludes archived projects)', () => {
    expect(selectorsUsed).toContain(selectAllTasksInActiveProjects);
    expect(selectorsUsed).not.toContain(selectAllTasks);
  });

  it('hides edit and delete for GENERAL and shows the system badge', () => {
    const general = buttonsOf(GENERAL_MODULE_ID);
    expect(general.edit).toBeNull();
    expect(general.del).toBeNull();
    expect(cardOf(GENERAL_MODULE_ID).querySelector('.module-system-badge')).toBeTruthy();
    const other = buttonsOf('m1');
    expect(other.edit).toBeTruthy();
    expect(other.del).toBeTruthy();
    expect(cardOf('m1').querySelector('.module-system-badge')).toBeNull();
  });

  it('falls back to an icon when the image fails or is missing', () => {
    expect(cardOf(GENERAL_MODULE_ID).querySelector('.module-icon-fallback')).toBeTruthy();
    const img = cardOf('m1').querySelector('img.module-icon') as HTMLImageElement;
    expect(img).toBeTruthy();
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(cardOf('m1').querySelector('img.module-icon')).toBeNull();
    expect(cardOf('m1').querySelector('.module-icon-fallback')).toBeTruthy();
  });

  it('shows the create hint only when GENERAL is the only module', () => {
    expect(el.querySelector('.module-create-hint')).toBeNull();
    modules.set([GENERAL_MODULE]);
    fixture.detectChanges();
    expect(el.querySelector('.module-create-hint')).toBeTruthy();
  });

  it('lists the tasks of a clicked module and can close the list', () => {
    cardOf('m1').click();
    fixture.detectChanges();
    const items = Array.from(el.querySelectorAll('.module-task-item')).map((e) =>
      e.textContent!.trim(),
    );
    expect(items).toEqual(['Task 1', 'Task 2']);

    (el.querySelector('.module-tasks-close-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.module-tasks')).toBeNull();
  });

  it('shows an empty state for a module without tasks', () => {
    modules.update((m) => [...m, { id: 'm2', name: 'Two' }]);
    fixture.detectChanges();
    cardOf('m2').click();
    fixture.detectChanges();
    expect(el.querySelector('.module-no-tasks')).toBeTruthy();
  });

  it('shows GENERAL fields read-only and refuses to save', () => {
    fixture.componentInstance.startEdit(GENERAL_MODULE);
    fixture.detectChanges();
    expect((el.querySelector('.module-name') as HTMLInputElement).readOnly).toBeTrue();
    expect(
      (el.querySelector('.module-description') as HTMLInputElement).readOnly,
    ).toBeTrue();
    expect(
      (el.querySelector('.module-icon-url') as HTMLInputElement).readOnly,
    ).toBeTrue();
    expect(
      (el.querySelector('.module-save-btn') as HTMLButtonElement).disabled,
    ).toBeTrue();

    fixture.componentInstance.save();
    expect(serviceSpy.update).not.toHaveBeenCalled();
  });

  it('shows an error for an invalid iconUrl and blocks saving', () => {
    fixture.componentInstance.startAdd();
    fixture.detectChanges();
    setInput('.module-name', 'Name');
    setInput('.module-icon-url', 'not a url');

    expect(el.querySelector('.module-icon-url-error')).toBeTruthy();
    expect(
      (el.querySelector('.module-save-btn') as HTMLButtonElement).disabled,
    ).toBeTrue();

    setInput('.module-icon-url', 'https://example.com/i.png');
    expect(el.querySelector('.module-icon-url-error')).toBeNull();
    expect(
      (el.querySelector('.module-save-btn') as HTMLButtonElement).disabled,
    ).toBeFalse();
  });

  it('creates a module from the form', () => {
    fixture.componentInstance.startAdd();
    fixture.detectChanges();
    setInput('.module-name', ' Docs ');
    fixture.componentInstance.save();
    expect(serviceSpy.add).toHaveBeenCalledWith({
      name: 'Docs',
      description: undefined,
      iconUrl: undefined,
    });
  });
});
