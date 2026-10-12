import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { LayoutService } from '../../core-ui/layout/layout.service';
import { hidePluginPanel } from '../../core-ui/layout/store/layout.actions';
import { TaskService } from '../tasks/task.service';
import { TimeEntryPanelService } from './time-entry-panel.service';

describe('TimeEntryPanelService', () => {
  let service: TimeEntryPanelService;
  let layoutService: jasmine.SpyObj<LayoutService>;
  let taskService: jasmine.SpyObj<TaskService>;
  let store: MockStore;

  beforeEach(() => {
    layoutService = jasmine.createSpyObj<LayoutService>('LayoutService', [
      'hideNotes',
      'hideAddTaskPanel',
      'hideTaskViewCustomizerPanel',
      'hideScheduleDayPanel',
    ]);
    taskService = jasmine.createSpyObj<TaskService>('TaskService', ['setSelectedId']);
    TestBed.configureTestingModule({
      providers: [
        TimeEntryPanelService,
        provideMockStore(),
        { provide: LayoutService, useValue: layoutService },
        { provide: TaskService, useValue: taskService },
      ],
    });
    store = TestBed.inject(MockStore);
    spyOn(store, 'dispatch');
    service = TestBed.inject(TimeEntryPanelService);
  });

  it('shows the entry and closes the other right panels', () => {
    service.open({ taskId: 't1', entryId: 'e1' });

    expect(service.target()).toEqual({ taskId: 't1', entryId: 'e1' });
    expect(taskService.setSelectedId).toHaveBeenCalledWith(null);
    expect(layoutService.hideNotes).toHaveBeenCalled();
    expect(layoutService.hideAddTaskPanel).toHaveBeenCalled();
    expect(layoutService.hideTaskViewCustomizerPanel).toHaveBeenCalled();
    expect(layoutService.hideScheduleDayPanel).toHaveBeenCalled();
    expect(store.dispatch).toHaveBeenCalledWith(hidePluginPanel());
  });

  it('closes', () => {
    service.open({ isRunning: true });
    service.close();

    expect(service.target()).toBeNull();
  });
});
