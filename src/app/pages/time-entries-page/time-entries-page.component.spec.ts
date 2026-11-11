import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TimeEntriesPageComponent } from './time-entries-page.component';
import { DialogExportPreviewComponent } from '../../features/time-entries/dialog-export-preview/dialog-export-preview.component';
import { TimeEntriesWeekComponent } from '../../features/time-entries/time-entries-week/time-entries-week.component';
import {
  TimeEntryRow,
  TimeEntryService,
} from '../../features/time-entries/time-entry.service';
import { TimeEntryRecorderService } from '../../features/time-entries/time-entry-recorder.service';
import {
  TimeEntryPanelService,
  TimeEntryPanelTarget,
} from '../../features/time-entries/time-entry-panel.service';
import { TimeEntryMoveComponent } from '../../features/time-entries/time-entry-move/time-entry-move.component';
import { By } from '@angular/platform-browser';
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
  let panelService: {
    entryChangedCount: ReturnType<typeof signal<number>>;
    target: ReturnType<typeof signal<TimeEntryPanelTarget | null>>;
    close: jasmine.Spy;
    open: jasmine.Spy;
  };

  const task: Task = {
    ...DEFAULT_TASK,
    id: 't1',
    title: 'Write report',
    projectId: '',
  };
  const task2: Task = { ...task, id: 't2', title: 'Review report' };

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
      'updateEntry',
      'getExportTable',
      'createXlsxExport',
    ]);
    timeEntryService.updateEntry.and.resolveTo();
    panelService = {
      entryChangedCount: signal(0),
      target: signal<TimeEntryPanelTarget | null>(null),
      close: jasmine.createSpy('close'),
      open: jasmine.createSpy('open'),
    };
    timeEntryService.getExportTable.and.resolveTo({
      sheetName: 'Time entries',
      columns: [{ id: 'date', header: 'Date', width: 12 }],
      rows: [],
    });
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
            { selector: selectAllTasks, value: [task, task2] },
            {
              selector: selectTaskEntities,
              value: { [task.id]: task, [task2.id]: task2 },
            },
            { selector: selectAllTagsWithoutMyDay, value: [] },
          ],
        }),
        { provide: TimeEntryService, useValue: timeEntryService },
        { provide: SnackService, useValue: snackService },
        {
          provide: TimeEntryRecorderService,
          useValue: { openSession: signal(null), setOpenSessionFields: () => {} },
        },
        { provide: TimeEntryPanelService, useValue: panelService },
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

  beforeEach(() => localStorage.removeItem(LS.TIME_ENTRIES_EXPORT_COLUMNS));

  afterEach(() => {
    localStorage.removeItem(LS.TIME_ENTRIES_VIEW);
    localStorage.removeItem(LS.TIME_ENTRIES_EXPORT_COLUMNS);
  });

  it('has no column settings button or panel (columns are chosen in the preview)', async () => {
    await createComponent('list');

    expect(fixture.nativeElement.querySelector('button.export-settings-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.export-settings')).toBeNull();
    expect(fixture.nativeElement.querySelector('.export-column')).toBeNull();
  });

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

  describe('list view with an entry', () => {
    const entryRow = (forTask: Task): TimeEntryRow =>
      ({
        task: forTask,
        entry: { id: `e-${forTask.id}`, start: 1_000_000, end: 2_000_000 },
        isArchived: false,
      }) as TimeEntryRow;

    const taskTitles = (): string[] =>
      Array.from(
        fixture.nativeElement.querySelectorAll('.entry-row:not(.header) .task-title'),
      ).map((el) => (el as HTMLElement).textContent!.trim());

    const moveComponent = (): TimeEntryMoveComponent =>
      fixture.debugElement.query(By.directive(TimeEntryMoveComponent)).componentInstance;

    const showEntryOf = (forTask: Task): void => {
      timeEntryService.getEntriesForDay.and.resolveTo({
        rows: [entryRow(forTask)],
        entriesTotal: 1_000_000,
        dayTotal: 1_000_000,
      } as any);
    };

    beforeEach(() => {
      showEntryOf(task);
    });

    it('has no convert button any more', async () => {
      await createComponent('list');

      expect(fixture.nativeElement.querySelector('.convert-btn')).toBeNull();
      expect(
        Array.from(fixture.nativeElement.querySelectorAll('mat-icon')).some(
          (icon) => (icon as HTMLElement).textContent?.trim() === 'history',
        ),
      ).toBe(false);
    });

    it('shows the move button on the entry', async () => {
      await createComponent('list');

      expect(taskTitles()).toEqual(['Write report']);
      expect(fixture.nativeElement.querySelector('button.move-btn')).not.toBeNull();
    });

    it('moves the entry from the list and shows it under the new task', async () => {
      await createComponent('list');
      timeEntryService.getEntriesForDay.calls.reset();
      showEntryOf(task2);

      await moveComponent().selectTask('t2');
      await settle();

      expect(timeEntryService.updateEntry).toHaveBeenCalledOnceWith(
        't1',
        'e-t1',
        1_000_000,
        2_000_000,
        't2',
      );
      expect(timeEntryService.getEntriesForDay).toHaveBeenCalled();
      expect(taskTitles()).toEqual(['Review report']);
    });

    it('closes the note drawer of an entry moved from the list', async () => {
      await createComponent('list');
      panelService.target.set({ taskId: 't1', entryId: 'e-t1' });

      await moveComponent().selectTask('t2');
      await settle();

      expect(panelService.close).toHaveBeenCalled();
    });

    it('reloads the list after the entry was moved from the drawer', async () => {
      await createComponent('list');
      expect(taskTitles()).toEqual(['Write report']);
      showEntryOf(task2);

      // the drawer moved the entry and reports the change
      panelService.entryChangedCount.update((n) => n + 1);
      await settle();

      expect(taskTitles()).toEqual(['Review report']);
    });
  });

  it('opens the export preview and downloads nothing on export', async () => {
    await createComponent('list');
    const dialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
    component.exportFrom.set('2026-10-01');
    component.exportTo.set('2026-10-31');

    await component.exportXlsx();
    await settle();

    expect(timeEntryService.getExportTable).toHaveBeenCalledWith(
      '2026-10-01',
      '2026-10-31',
    );
    expect(dialog.open).toHaveBeenCalledTimes(1);
    const [componentType, config] = dialog.open.calls.mostRecent().args as [
      unknown,
      { data: { from: string; to: string } },
    ];
    expect(componentType).toBe(DialogExportPreviewComponent);
    expect(config.data.from).toBe('2026-10-01');
    expect(config.data.to).toBe('2026-10-31');
    expect(timeEntryService.createXlsxExport).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('shows an error and opens no preview for an invalid export range', async () => {
    await createComponent('list');
    const dialog = TestBed.inject(MatDialog) as jasmine.SpyObj<MatDialog>;
    component.exportFrom.set('2026-10-31');
    component.exportTo.set('2026-10-01');

    await component.exportXlsx();
    await settle();

    expect(snackService.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: 'ERROR',
        msg: T.F.TIME_ENTRIES.ERR_EXPORT_RANGE,
      }),
    );
    expect(dialog.open).not.toHaveBeenCalled();
    expect(timeEntryService.getExportTable).not.toHaveBeenCalled();
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
