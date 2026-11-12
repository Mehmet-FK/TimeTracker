import { ElementRef } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import {
  MOVE_BLUR_CLOSE_DELAY_MS,
  TimeEntryMoveComponent,
} from './time-entry-move.component';
import { filterLeafTasks, MAX_TASK_OPTIONS } from './task-options.util';
import { TimeEntryService } from '../time-entry.service';
import { SnackService } from '../../../core/snack/snack.service';
import { selectAllTasks } from '../../tasks/store/task.selectors';
import { DEFAULT_TASK, Task } from '../../tasks/task.model';
import { T } from '../../../t.const';

const createTask = (id: string, title: string, changes: Partial<Task> = {}): Task => ({
  ...DEFAULT_TASK,
  id,
  title,
  projectId: '',
  ...changes,
});

const parent = createTask('parent', 'Parent task', { subTaskIds: ['sub'] });
const sub = createTask('sub', 'Sub task', { parentId: 'parent' });
const t1 = createTask('t1', 'Write report');
const t2 = createTask('t2', 'Review report');
const t3 = createTask('t3', 'Plan sprint');

describe('filterLeafTasks', () => {
  it('leaves out tasks with sub tasks', () => {
    expect(filterLeafTasks([parent, sub, t1], '').map((t) => t.id)).toEqual([
      'sub',
      't1',
    ]);
  });

  it('matches the title case-insensitively and ignores surrounding blanks', () => {
    expect(filterLeafTasks([t1, t2, t3], '  REPORT ').map((t) => t.id)).toEqual([
      't1',
      't2',
    ]);
    expect(filterLeafTasks([t1, t2, t3], 'nothing')).toEqual([]);
  });

  it('limits the number of options', () => {
    const many = Array.from({ length: MAX_TASK_OPTIONS + 5 }, (_, i) =>
      createTask(`m${i}`, `Task ${i}`),
    );
    expect(filterLeafTasks(many, '').length).toBe(MAX_TASK_OPTIONS);
  });
});

describe('TimeEntryMoveComponent', () => {
  let fixture: ComponentFixture<TimeEntryMoveComponent>;
  let component: TimeEntryMoveComponent;
  let timeEntryService: jasmine.SpyObj<TimeEntryService>;
  let snackService: jasmine.SpyObj<SnackService>;
  let movedSpy: jasmine.Spy;

  const button = (): HTMLButtonElement | null =>
    fixture.nativeElement.querySelector('button.move-btn');

  beforeEach(() => {
    timeEntryService = jasmine.createSpyObj<TimeEntryService>('TimeEntryService', [
      'updateEntry',
    ]);
    timeEntryService.updateEntry.and.resolveTo();
    snackService = jasmine.createSpyObj<SnackService>('SnackService', ['open']);

    TestBed.configureTestingModule({
      imports: [TimeEntryMoveComponent, NoopAnimationsModule, TranslateModule.forRoot()],
      providers: [
        provideMockStore({
          selectors: [{ selector: selectAllTasks, value: [parent, sub, t1, t2, t3] }],
        }),
        { provide: TimeEntryService, useValue: timeEntryService },
        { provide: SnackService, useValue: snackService },
      ],
    });
    fixture = TestBed.createComponent(TimeEntryMoveComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('taskId', 't1');
    fixture.componentRef.setInput('entryId', 'e1');
    fixture.componentRef.setInput('start', 1000);
    fixture.componentRef.setInput('end', 2000);
    movedSpy = jasmine.createSpy('moved');
    component.moved.subscribe(movedSpy);
    fixture.detectChanges();
  });

  it('shows the move button and turns it into a task search', () => {
    expect(button()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input.move-input')).toBeNull();

    button()!.click();
    fixture.detectChanges();

    expect(button()).toBeNull();
    expect(fixture.nativeElement.querySelector('input.move-input')).not.toBeNull();
  });

  it('hides the button when disabled', () => {
    fixture.componentRef.setInput('isDisabled', true);
    fixture.detectChanges();

    expect(button()).toBeNull();
  });

  it('offers only leaf tasks and filters them by the query', () => {
    expect(component.options().map((t) => t.id)).toEqual(['sub', 't1', 't2', 't3']);

    component.query.set('report');

    expect(component.options().map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('closes the search on escape without moving', () => {
    component.startMove();
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('input.move-input')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.isMoving()).toBe(false);
    expect(timeEntryService.updateEntry).not.toHaveBeenCalled();
  });

  describe('focus and closing', () => {
    let host: HTMLElement;

    beforeEach(() => {
      // focus only works on attached elements
      host = fixture.nativeElement;
      document.body.appendChild(host);
    });

    afterEach(() => host.remove());

    const moveInput = (): HTMLInputElement =>
      host.querySelector('input.move-input') as HTMLInputElement;

    it('focuses the search exactly once after starting to move', () => {
      const focusSpy = spyOn(HTMLElement.prototype, 'focus').and.callThrough();

      component.startMove();
      fixture.detectChanges();

      expect(focusSpy).toHaveBeenCalledTimes(1);
      expect(focusSpy.calls.mostRecent().object).toBe(moveInput());
      expect(document.activeElement).toBe(moveInput());

      // typing and further change detection must not focus it again
      component.query.set('rep');
      fixture.detectChanges();
      fixture.detectChanges();

      expect(focusSpy).toHaveBeenCalledTimes(1);
    });

    it('closes the search on blur without moving', fakeAsync(() => {
      component.startMove();
      fixture.detectChanges();

      moveInput().blur();
      tick(MOVE_BLUR_CLOSE_DELAY_MS);
      fixture.detectChanges();

      expect(component.isMoving()).toBe(false);
      expect(moveInput()).toBeNull();
      expect(timeEntryService.updateEntry).not.toHaveBeenCalled();
      expect(movedSpy).not.toHaveBeenCalled();
    }));

    it('stays open when the blur goes to an autocomplete option', fakeAsync(() => {
      component.startMove();
      fixture.detectChanges();
      const panel = document.createElement('div');
      const option = document.createElement('mat-option');
      panel.appendChild(option);
      const autocomplete = fixture.debugElement
        .query(By.directive(MatAutocomplete))
        .injector.get(MatAutocomplete);
      autocomplete.panel = new ElementRef(panel);

      moveInput().dispatchEvent(new FocusEvent('blur', { relatedTarget: option }));
      tick(MOVE_BLUR_CLOSE_DELAY_MS);

      expect(component.isMoving()).toBe(true);
    }));

    it('moves the entry and closes the search when an option is selected', async () => {
      component.startMove();
      fixture.detectChanges();
      const autocomplete = fixture.debugElement
        .query(By.directive(MatAutocomplete))
        .injector.get(MatAutocomplete);
      const trigger = fixture.debugElement
        .query(By.directive(MatAutocompleteTrigger))
        .injector.get(MatAutocompleteTrigger);
      trigger.openPanel();
      fixture.detectChanges();
      await fixture.whenStable();

      const option = autocomplete.options.find((o) => o.value === 't2')!;
      option._selectViaInteraction();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(timeEntryService.updateEntry).toHaveBeenCalledOnceWith(
        't1',
        'e1',
        1000,
        2000,
        't2',
      );
      expect(movedSpy).toHaveBeenCalledOnceWith('t2');
      expect(component.isMoving()).toBe(false);
      expect(moveInput()).toBeNull();
    });
  });

  it('renders the search as a plain input by default', () => {
    component.startMove();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input.move-input');
    expect(input.classList).toContain('plain-input');
    expect(input.closest('mat-form-field')).toBeNull();
  });

  it('renders the search as an outlined field labelled Task with the outline appearance', () => {
    fixture.componentRef.setInput('appearance', 'outline');
    component.startMove();
    fixture.detectChanges();

    const field = fixture.nativeElement.querySelector('mat-form-field.move-field');
    expect(field).not.toBeNull();
    expect(field.querySelector('input.move-input')).not.toBeNull();
    expect(field.querySelector('mat-label').textContent).toContain(T.F.TIME_ENTRIES.TASK);
  });

  it('moves the entry to the selected task', async () => {
    component.startMove();

    await component.selectTask('t2');

    expect(timeEntryService.updateEntry).toHaveBeenCalledOnceWith(
      't1',
      'e1',
      1000,
      2000,
      't2',
    );
    expect(movedSpy).toHaveBeenCalledOnceWith('t2');
    expect(component.isMoving()).toBe(false);
  });

  it('does nothing when the same task is selected', async () => {
    component.startMove();

    await component.selectTask('t1');

    expect(timeEntryService.updateEntry).not.toHaveBeenCalled();
    expect(movedSpy).not.toHaveBeenCalled();
    expect(component.isMoving()).toBe(false);
  });

  it('shows an error and does not report a move when saving fails', async () => {
    timeEntryService.updateEntry.and.rejectWith(new Error('boom'));

    await component.selectTask('t2');

    expect(snackService.open).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'ERROR', msg: T.F.TIME_ENTRIES.ERR_SAVE }),
    );
    expect(movedSpy).not.toHaveBeenCalled();
  });
});
