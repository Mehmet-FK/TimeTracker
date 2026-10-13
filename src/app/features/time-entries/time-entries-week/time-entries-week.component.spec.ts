import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TimeEntriesWeekComponent } from './time-entries-week.component';
import { TimeEntryPanelService } from '../time-entry-panel.service';
import {
  OpenTimeEntrySession,
  TimeEntryRecorderService,
} from '../time-entry-recorder.service';
import { selectAllProjects } from '../../project/store/project.selectors';
import { selectTaskEntities } from '../../tasks/store/task.selectors';
import { selectAllTagsWithoutMyDay } from '../../tag/store/tag.reducer';
import { DEFAULT_TASK, Task } from '../../tasks/task.model';
import { TimeEntryRow } from '../time-entry.service';
import { combineDayAndTime } from '../time-entry.util';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';

const at = (day: string, time: string): number => combineDayAndTime(day, time);

describe('TimeEntriesWeekComponent', () => {
  let fixture: ComponentFixture<TimeEntriesWeekComponent>;
  let panelService: jasmine.SpyObj<TimeEntryPanelService>;
  let openSession: ReturnType<typeof signal<OpenTimeEntrySession | null>>;

  const task: Task = {
    ...DEFAULT_TASK,
    id: 't1',
    title: 'Write report',
    projectId: 'p1',
  };
  const rows: TimeEntryRow[] = [
    {
      task,
      entry: {
        id: 'e1',
        start: at('2026-10-13', '09:00'),
        end: at('2026-10-13', '10:30'),
      },
      isArchived: false,
    },
    {
      task,
      entry: {
        id: 'e2',
        start: at('2026-10-13', '13:00'),
        end: at('2026-10-13', '14:00'),
      },
      isArchived: false,
    },
  ];

  const blocks = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.block'));

  beforeEach(() => {
    panelService = jasmine.createSpyObj<TimeEntryPanelService>('TimeEntryPanelService', [
      'open',
    ]);
    openSession = signal<OpenTimeEntrySession | null>(null);

    TestBed.configureTestingModule({
      imports: [TimeEntriesWeekComponent, TranslateModule.forRoot()],
      providers: [
        provideMockStore({
          selectors: [
            {
              selector: selectAllProjects,
              value: [{ id: 'p1', theme: { primary: '#ff0000' } }],
            },
            { selector: selectTaskEntities, value: { t1: task } },
            { selector: selectAllTagsWithoutMyDay, value: [] },
          ],
        }),
        { provide: TimeEntryPanelService, useValue: panelService },
        { provide: TimeEntryRecorderService, useValue: { openSession } },
        {
          provide: DateTimeFormatService,
          useValue: { currentLocale: () => 'en-gb', formatTime: () => '09:00' },
        },
      ],
    });
    fixture = TestBed.createComponent(TimeEntriesWeekComponent);
    fixture.componentRef.setInput('weekStart', '2026-10-12');
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
  });

  it('shows seven days from Monday with their totals', () => {
    const heads = Array.from(
      fixture.nativeElement.querySelectorAll('.day-head') as NodeListOf<HTMLElement>,
    );

    expect(heads.length).toBe(7);
    expect(heads[0].textContent).toContain('Monday');
    expect(heads[6].textContent).toContain('Sunday');
    expect(heads[1].querySelector('.day-total')?.textContent?.trim()).toBe('2h 30m');
  });

  it('places entries by time with title, duration and project color', () => {
    const [first] = blocks();

    expect(blocks().length).toBe(2);
    expect(first.textContent).toContain('Write report');
    expect(first.textContent).toContain('1h 30m');
    expect(first.style.top).toBe(`${(9 / 24) * 100}%`);
    expect(first.style.getPropertyValue('--block-color')).toBe('#ff0000');
  });

  it('opens the entry panel on click', () => {
    blocks()[0].click();

    expect(panelService.open).toHaveBeenCalledWith({ taskId: 't1', entryId: 'e1' });
  });

  it('shows the running entry up to now and opens it', () => {
    openSession.set({
      taskId: 't1',
      start: at('2026-10-14', '08:00'),
      lastSeen: at('2026-10-14', '08:30'),
    });
    fixture.detectChanges();

    const running = fixture.nativeElement.querySelector('.block.is-running');
    expect(running.textContent).toContain('30m');
    running.click();
    expect(panelService.open).toHaveBeenCalledWith({ isRunning: true });
  });
});
