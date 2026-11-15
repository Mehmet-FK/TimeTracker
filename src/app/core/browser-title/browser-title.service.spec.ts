import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { BrowserTitleService } from './browser-title.service';
import { TaskService } from '../../features/tasks/task.service';
import { DateService } from '../date/date.service';
import { Task } from '../../features/tasks/task.model';

const TODAY_STR = '2026-07-26';

describe('BrowserTitleService', () => {
  let service: BrowserTitleService;
  let titleService: jasmine.SpyObj<Title>;
  let currentTask$: BehaviorSubject<Task | null>;

  beforeEach(() => {
    titleService = jasmine.createSpyObj('Title', ['setTitle']);
    currentTask$ = new BehaviorSubject<Task | null>(null);

    TestBed.configureTestingModule({
      providers: [
        BrowserTitleService,
        { provide: Title, useValue: titleService },
        { provide: TaskService, useValue: { currentTask$ } },
        { provide: DateService, useValue: { todayStr: () => TODAY_STR } },
      ],
    });

    service = TestBed.inject(BrowserTitleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('plain time tracking', () => {
    const taskWithTimeToday = (ms: number): Task =>
      ({
        id: 'T1',
        title: 'Some task',
        timeSpentOnDay: ms ? { [TODAY_STR]: ms } : {},
      }) as unknown as Task;

    it('should show base title when nothing is tracked', () => {
      TestBed.flushEffects();

      expect(titleService.setTitle).toHaveBeenCalledWith('Super Productivity');
    });

    it("should show today's time and the task title", () => {
      currentTask$.next(taskWithTimeToday(1500000));

      TestBed.flushEffects();

      expect(titleService.setTitle).toHaveBeenCalledWith('25m - Some task');
    });

    it('should show 0m rather than a dash placeholder for a fresh task', () => {
      currentTask$.next(taskWithTimeToday(0));

      TestBed.flushEffects();

      expect(titleService.setTitle).toHaveBeenCalledWith('0m - Some task');
    });

    it('should fall back to the base title once tracking stops', () => {
      currentTask$.next(taskWithTimeToday(3600000));
      TestBed.flushEffects();
      expect(titleService.setTitle).toHaveBeenCalledWith('1h - Some task');

      currentTask$.next(null);
      TestBed.flushEffects();

      expect(titleService.setTitle).toHaveBeenCalledWith('Super Productivity');
    });
  });
});
