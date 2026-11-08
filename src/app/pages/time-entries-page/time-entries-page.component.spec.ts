import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TimeEntriesPageComponent } from './time-entries-page.component';
import { TimeEntriesWeekComponent } from '../../features/time-entries/time-entries-week/time-entries-week.component';
import {
  TimeEntryRow,
  TimeEntryService,
} from '../../features/time-entries/time-entry.service';
import { TimeEntryRecorderService } from '../../features/time-entries/time-entry-recorder.service';
import { TimeEntryPanelService } from '../../features/time-entries/time-entry-panel.service';
import {
  selectAllTasks,
  selectTaskEntities,
} from '../../features/tasks/store/task.selectors';
import { selectAllTagsWithoutMyDay } from '../../features/tag/store/tag.reducer';
import { DEFAULT_TASK, Task } from '../../features/tasks/task.model';
import { TaskService } from '../../features/tasks/task.service';
import { DateService } from '../../core/date/date.service';
import { SnackService } from '../../core/snack/snack.service';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { LS } from '../../core/persistence/storage-keys.const';
import { T } from '../../t.const';

@Component({
  selector: 'time-entries-week',
  template: '<div class="week-stub"></div>',
  standalone: true,
})
class WeekStubComponent {
  weekStart = input<string>();
  rows = input<TimeEntryRow[]>();
}

describe('TimeEntriesPageComponent', () => {
  let fixture: ComponentFixture<TimeEntriesPageComponent>;
  let component: TimeEntriesPageComponent;
  let timeEntryService: jasmine.SpyObj<TimeEntryService>;
  let snackService: jasmine.SpyObj<SnackService>;

  const task: Task = {
    ...DEFAULT_TASK,
    id: 't1',
    title: 'Write report',
    projectId: '',
  };

  // the page loads with plain promises, which zoneless whenStable() does not track
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
  };

  const createComponent = async (view: 'list' | 'week'): Promise<void> => {
    localStorage.setItem(LS.TIME_ENTRIES_VIEW, view);
    fixture = TestBed.createComponent(TimeEntriesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  };

  const form = (): HTMLFormElement | null =>
    fixture.nativeElement.querySelector('form.add-form');

  const submitForm = async (): Promise<void> => {
    form()!.dispatchEvent(new Event('submit'));
    await settle();
  };

  beforeEach(() => {
    timeEntryService = jasmine.createSpyObj<TimeEntryService>('TimeEntryService', [
      'getEntriesForDay',
      'getEntriesBetween',
      'getUsedFieldValues',
      'addEntry',
    ]);
    timeEntryService.getEntriesForDay.and.resolveTo({
      rows: [],
      entriesTotal: 0,
      dayTotal: 0,
    } as any);
    timeEntryService.getEntriesBetween.and.resolveTo([]);
    timeEntryService.getUsedFieldValues.and.resolveTo({});
    timeEntryService.addEntry.and.resolveTo();
    snackService = jasmine.createSpyObj<SnackService>('SnackService', ['open']);

    TestBed.configureTestingModule({
      imports: [
        TimeEntriesPageComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideMockStore({
          selectors: [
            { selector: selectAllTasks, value: [task] },
            { selector: selectTaskEntities, value: { [task.id]: task } },
            { selector: selectAllTagsWithoutMyDay, value: [] },
          ],
        }),
        { provide: TimeEntryService, useValue: timeEntryService },
        { provide: SnackService, useValue: snackService },
        {
          provide: TimeEntryRecorderService,
          useValue: { openSession: signal(null), setOpenSessionFields: () => {} },
        },
        {
          provide: TimeEntryPanelService,
          useValue: {
            entryChangedCount: signal(0),
            target: signal(null),
            close: () => {},
            open: () => {},
          },
        },
        { provide: TaskService, useValue: jasmine.createSpyObj('TaskService', ['add']) },
        {
          provide: DateService,
          useValue: {
            todayStr: () => '2026-10-14',
            getStartOfNextDayDiffMs: () => 0,
          },
        },
        {
          provide: DataInitStateService,
          useValue: { isAllDataLoadedInitially$: of(true) },
        },
        { provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open']) },
      ],
    });
    TestBed.overrideComponent(TimeEntriesPageComponent, {
      remove: { imports: [TimeEntriesWeekComponent] },
      add: { imports: [WeekStubComponent] },
    });
  });

  afterEach(() => localStorage.removeItem(LS.TIME_ENTRIES_VIEW));

  it('shows the add form and the week in the week view', async () => {
    await createComponent('week');

    expect(form()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="task"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="start"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="end"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('datalist')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.week-stub')).not.toBeNull();
    expect(timeEntryService.getUsedFieldValues).toHaveBeenCalled();
  });

  it('still shows the add form in the list view', async () => {
    await createComponent('list');

    expect(form()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.week-stub')).toBeNull();
    expect(fixture.nativeElement.querySelector('datalist')).not.toBeNull();
  });

  it('adds the entry for the selected day and reloads the week', async () => {
    await createComponent('week');
    timeEntryService.getEntriesBetween.calls.reset();
    const newRow = {
      task,
      entry: { id: 'e1', start: 1, end: 2 },
      isArchived: false,
    } as TimeEntryRow;
    timeEntryService.getEntriesBetween.and.resolveTo([newRow]);

    component.onTaskQueryChange('Write report');
    component.selectTask(task);
    component.newStart.set('09:00');
    component.newEnd.set('10:00');
    await submitForm();

    expect(timeEntryService.addEntry).toHaveBeenCalledTimes(1);
    const [taskId, start, end] = timeEntryService.addEntry.calls.mostRecent().args;
    expect(taskId).toBe('t1');
    expect(end - start).toBe(60 * 60 * 1000);
    expect(new Date(start).getHours()).toBe(9);
    expect(new Date(start).getDate()).toBe(14);
    expect(timeEntryService.getEntriesBetween).toHaveBeenCalled();
    expect(component.weekData()?.rows).toEqual([newRow]);
    expect(component.newTaskQuery()).toBe('');
  });

  it('shows an error and does not add without a task', async () => {
    await createComponent('week');
    component.newStart.set('09:00');
    component.newEnd.set('10:00');
    await submitForm();

    expect(timeEntryService.addEntry).not.toHaveBeenCalled();
    expect(snackService.open).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'ERROR', msg: T.F.TIME_ENTRIES.ERR_NO_TASK }),
    );
  });

  it('shows an error and does not add without times', async () => {
    await createComponent('week');
    component.onTaskQueryChange('Write report');
    component.selectTask(task);
    await submitForm();

    expect(timeEntryService.addEntry).not.toHaveBeenCalled();
    expect(snackService.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: 'ERROR',
        msg: T.F.TIME_ENTRIES.ERR_INVALID_RANGE,
      }),
    );
  });
});
