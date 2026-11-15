import * as fromSelectors from './planner.selectors';
import { plannerFeatureKey, PlannerState } from './planner.reducer';
import { Task, TaskState } from '../../tasks/task.model';
import { TASK_FEATURE_NAME } from '../../tasks/store/task.reducer';
import { PROJECT_FEATURE_NAME } from '../../project/store/project.reducer';
import { appStateFeatureKey } from '../../../root-store/app-state/app-state.reducer';
import { getDbDateStr } from '../../../util/get-db-date-str';

// Helper to create a timestamp for a specific day at a given hour local time
const getLocalTime = (year: number, month: number, day: number, hour: number): number => {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
};

describe('Planner Selectors - selectPlannerDays', () => {
  const today = getDbDateStr();

  const createMockTask = (overrides: Partial<Task> & { id: string }): Task => {
    const { id, ...rest } = overrides;
    return {
      id,
      title: `Task ${id}`,
      created: Date.now(),
      isDone: false,
      subTaskIds: [],
      tagIds: [],
      projectId: 'project1',
      timeSpentOnDay: {},
      timeEstimate: 0,
      timeSpent: 0,
      attachments: [],
      ...rest,
    };
  };

  const createTasksMapFromTasksArray = (tasks: Task[]): Map<string, Task> =>
    new Map(tasks.map((t) => [t.id, t]));

  const emptyPlannerState: PlannerState = {
    days: {},
    addPlannedTasksDialogLastShown: undefined,
  };

  const defaultScheduleConfig = {
    isWorkStartEndEnabled: false,
    workStart: '09:00',
    workEnd: '17:00',
    isLunchBreakEnabled: false,
    lunchBreakStart: '12:00',
    lunchBreakEnd: '13:00',
  };

  // The factory returns a selector; test its projector directly
  const createPlannerDaysSelector = (
    dayDates: string[] = [today],
    todayStr: string = today,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  ) => fromSelectors.selectPlannerDays(dayDates, [], [], [], todayStr);

  it('should return a PlannerDay for each day date', () => {
    const tasks = createTasksMapFromTasksArray([]);
    const selector = createPlannerDaysSelector([today]);
    const result = selector.projector(tasks, emptyPlannerState, defaultScheduleConfig, 0);

    expect(result.length).toBe(1);
    expect(result[0].dayDate).toBe(today);
    expect(result[0].isToday).toBe(true);
  });

  it('should include tasks from planner state for a non-today day', () => {
    const tomorrow = getDbDateStr(new Date(Date.now() + 86400000));
    const task = createMockTask({ id: 't1', title: 'Plan task' });
    const plannerState: PlannerState = {
      ...emptyPlannerState,
      days: { [tomorrow]: ['t1'] },
    };

    const selector = fromSelectors.selectPlannerDays([tomorrow], [], [], [], today);
    const tasks = createTasksMapFromTasksArray([task]);
    const result = selector.projector(tasks, plannerState, defaultScheduleConfig, 0);

    expect(result[0].tasks.length).toBe(1);
    expect(result[0].tasks[0].id).toBe('t1');
  });

  it('should include unplanned today tasks passed to factory', () => {
    const task = createMockTask({ id: 't1', title: 'Today task' });

    // Pass t1 as a todayListTaskId (unplanned since allPlannedTasks is empty)
    const selector = fromSelectors.selectPlannerDays([today], [], ['t1'], [], today);
    const tasks = createTasksMapFromTasksArray([task]);
    const result = selector.projector(tasks, emptyPlannerState, defaultScheduleConfig, 0);

    expect(result[0].tasks.length).toBe(1);
    expect(result[0].tasks[0].id).toBe('t1');
  });

  it('should compute availableHours when schedule config is enabled', () => {
    const scheduleConfig = {
      isWorkStartEndEnabled: true,
      workStart: '09:00',
      workEnd: '17:00',
      isLunchBreakEnabled: false,
      lunchBreakStart: '12:00',
      lunchBreakEnd: '13:00',
    };
    const selector = createPlannerDaysSelector([today]);
    const tasks = createTasksMapFromTasksArray([]);
    const result = selector.projector(tasks, emptyPlannerState, scheduleConfig, 0);

    // 8 hours = 28800000 ms
    expect(result[0].availableHours).toBe(28800000);
    expect(result[0].progressPercentage).toBe(0);
  });

  it('should not set availableHours when schedule is disabled', () => {
    const selector = createPlannerDaysSelector([today]);
    const tasks = createTasksMapFromTasksArray([]);
    const result = selector.projector(tasks, emptyPlannerState, defaultScheduleConfig, 0);

    expect(result[0].availableHours).toBeUndefined();
    expect(result[0].progressPercentage).toBeUndefined();
  });

  it('should not expand the loaded range for a far-future planner day', () => {
    const farFutureDay = '2099-12-31';
    const task = createMockTask({ id: 'far-future-task' });
    const plannerState: PlannerState = {
      ...emptyPlannerState,
      days: { [farFutureDay]: ['far-future-task'] },
    };

    const selector = createPlannerDaysSelector(
      ['2026-07-25', '2026-07-26'],
      '2026-07-25',
    );
    const tasks = createTasksMapFromTasksArray([task]);
    const result = selector.projector(tasks, plannerState, defaultScheduleConfig, 0);

    expect(result.map((day) => day.dayDate)).toEqual(['2026-07-25', '2026-07-26']);
  });

  it('should filter out deleted tasks from planner days', () => {
    const plannerState: PlannerState = {
      ...emptyPlannerState,
      days: { [today]: ['deleted-task'] },
    };

    const selector = createPlannerDaysSelector([today]);
    const tasks = createTasksMapFromTasksArray([]);
    const result = selector.projector(tasks, plannerState, defaultScheduleConfig, 0);

    expect(result[0].tasks.length).toBe(0);
  });

  it('should base timeEstimate and progress on task estimates only', () => {
    const scheduleConfig = {
      isWorkStartEndEnabled: true,
      workStart: '09:00',
      workEnd: '17:00',
      isLunchBreakEnabled: false,
      lunchBreakStart: '12:00',
      lunchBreakEnd: '13:00',
    };

    const task = createMockTask({
      id: 't1',
      title: 'Task with estimate',
      timeEstimate: 7200000,
    }); // 2 hours
    const plannerState: PlannerState = {
      ...emptyPlannerState,
      days: { [today]: ['t1'] },
    };

    const selector = fromSelectors.selectPlannerDays([today], [], ['t1'], [], today);
    const tasks = createTasksMapFromTasksArray([task]);
    const result = selector.projector(tasks, plannerState, scheduleConfig, 0);

    expect(result[0].timeEstimate).toBe(7200000);
    // availableHours = 8 hours = 28800000 ms
    expect(result[0].availableHours).toBe(28800000);
    // progressPercentage = (7200000 / 28800000) * 100 = 25%
    expect(result[0].progressPercentage).toBe(25);
  });

  it('should not count tracked time without an estimate as planned workload', () => {
    const thirtyMinutes = 30 * 60 * 1000;
    const task = createMockTask({
      id: 'tracked-without-estimate',
      timeSpent: thirtyMinutes,
      timeSpentOnDay: { [today]: thirtyMinutes },
      timeEstimate: 0,
    });
    const selector = fromSelectors.selectPlannerDays([today], [], [task.id], [], today);

    const result = selector.projector(
      createTasksMapFromTasksArray([task]),
      emptyPlannerState,
      defaultScheduleConfig,
      0,
    );

    expect(result[0].timeEstimate).toBe(0);
  });
});

describe('Planner Selectors - selectAllTasksDueToday', () => {
  const today = getDbDateStr();
  const yesterday = getDbDateStr(new Date(Date.now() - 86400000));
  const tomorrow = getDbDateStr(new Date(Date.now() + 86400000));

  // Helper to create a timestamp for today at a specific hour
  const getTodayAtHour = (hour: number): number => {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };

  // Helper to create a timestamp for tomorrow
  const getTomorrowAtHour = (hour: number): number => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };

  const createMockTask = (overrides: Partial<Task> & { id: string }): Task => {
    const { id, title, ...rest } = overrides;
    return {
      id,
      title: title || `Task ${id}`,
      created: Date.now(),
      isDone: false,
      subTaskIds: [],
      tagIds: [],
      projectId: 'project1',
      timeSpentOnDay: {},
      timeEstimate: 0,
      timeSpent: 0,
      attachments: [],
      ...rest,
    };
  };

  const mockTasks: { [id: string]: Task } = {
    taskDueToday: createMockTask({
      id: 'taskDueToday',
      title: 'Due Today',
      dueDay: today,
    }),
    taskDueTomorrow: createMockTask({
      id: 'taskDueTomorrow',
      title: 'Due Tomorrow',
      dueDay: tomorrow,
    }),
    taskOverdue: createMockTask({
      id: 'taskOverdue',
      title: 'Overdue',
      dueDay: yesterday,
    }),
    taskWithTimeToday: createMockTask({
      id: 'taskWithTimeToday',
      title: 'With Time Today',
      dueWithTime: getTodayAtHour(14),
    }),
    taskWithTimeTomorrow: createMockTask({
      id: 'taskWithTimeTomorrow',
      title: 'With Time Tomorrow',
      dueWithTime: getTomorrowAtHour(10),
    }),
    taskNoDue: createMockTask({ id: 'taskNoDue', title: 'No Due' }),
    taskOnPlannerOnly: createMockTask({
      id: 'taskOnPlannerOnly',
      title: 'On Planner Only',
    }),
  };

  const mockTaskState: TaskState = {
    ids: Object.keys(mockTasks),
    entities: mockTasks,
    currentTaskId: null,
    selectedTaskId: null,
    lastCurrentTaskId: null,
    isDataLoaded: true,
    taskDetailTargetPanel: null,
  };

  const mockPlannerState: PlannerState = {
    days: {
      [today]: ['taskOnPlannerOnly'], // Only this task is in planner for today
    },
    addPlannedTasksDialogLastShown: undefined,
  };

  const createMockState = (
    taskState: Partial<TaskState> = {},
    plannerState: Partial<PlannerState> = {},
    todayStr: string = today,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  ) => ({
    [appStateFeatureKey]: { todayStr, startOfNextDayDiffMs: 0 },
    [TASK_FEATURE_NAME]: { ...mockTaskState, ...taskState },
    [plannerFeatureKey]: { ...mockPlannerState, ...plannerState },
    [PROJECT_FEATURE_NAME]: { ids: [], entities: {} },
  });

  describe('selectAllTasksDueToday', () => {
    it('should return tasks with dueDay equal to today', () => {
      const mockState = createMockState();
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      const ids = result.map((t) => t.id);
      expect(ids).toContain('taskDueToday');
    });

    it('should return tasks with dueWithTime for today', () => {
      const mockState = createMockState();
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      const ids = result.map((t) => t.id);
      expect(ids).toContain('taskWithTimeToday');
    });

    it('should include tasks from planner state for today', () => {
      const mockState = createMockState();
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      const ids = result.map((t) => t.id);
      expect(ids).toContain('taskOnPlannerOnly');
    });

    it('should NOT include tasks due tomorrow', () => {
      const mockState = createMockState();
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      const ids = result.map((t) => t.id);
      expect(ids).not.toContain('taskDueTomorrow');
      expect(ids).not.toContain('taskWithTimeTomorrow');
    });

    it('should NOT include overdue tasks (dueDay in past)', () => {
      const mockState = createMockState();
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      const ids = result.map((t) => t.id);
      expect(ids).not.toContain('taskOverdue');
    });

    it('should NOT include tasks without due date', () => {
      const mockState = createMockState();
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      const ids = result.map((t) => t.id);
      expect(ids).not.toContain('taskNoDue');
    });

    it('should deduplicate tasks that appear in both planner and have dueDay', () => {
      // Task is both in planner AND has dueDay = today
      const taskInBoth = createMockTask({
        id: 'taskInBoth',
        title: 'In Both',
        dueDay: today,
      });

      const mockState = createMockState(
        {
          ids: [...mockTaskState.ids, 'taskInBoth'],
          entities: { ...mockTasks, taskInBoth },
        },
        {
          days: { [today]: ['taskInBoth'] },
        },
      );

      const result = fromSelectors.selectAllTasksDueToday(mockState);
      const matchingTasks = result.filter((t) => t.id === 'taskInBoth');

      expect(matchingTasks.length).toBe(1); // Should only appear once
    });

    it('should handle empty planner state', () => {
      const mockState = createMockState({}, { days: {} });
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      const ids = result.map((t) => t.id);
      // Should still find tasks with dueDay = today
      expect(ids).toContain('taskDueToday');
      expect(ids).toContain('taskWithTimeToday');
    });

    it('should handle empty task state', () => {
      const mockState = createMockState({ ids: [], entities: {} });
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      expect(result.length).toBe(0);
    });

    it('should handle missing entity references in planner days with empty task state gracefully', () => {
      const mockState = createMockState(
        { ids: [], entities: {} },
        { days: { [today]: ['nonexistent'] } },
      );

      expect(() => fromSelectors.selectAllTasksDueToday(mockState)).not.toThrow();
      expect(fromSelectors.selectAllTasksDueToday(mockState)).toEqual([]);
    });

    it('should handle missing entity references in planner gracefully', () => {
      // Planner references a task that doesn't exist in taskState
      const mockState = createMockState(
        {
          ids: ['taskDueToday'],
          entities: { taskDueToday: mockTasks.taskDueToday },
        },
        {
          days: { [today]: ['nonExistentTask', 'taskDueToday'] },
        },
      );

      const result = fromSelectors.selectAllTasksDueToday(mockState);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('taskDueToday');
    });

    it('should return correct count when combining planner and due tasks', () => {
      const mockState = createMockState();
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      // Expected: taskOnPlannerOnly (from planner), taskDueToday (dueDay), taskWithTimeToday (dueWithTime)
      expect(result.length).toBe(3);
    });

    it('should include task with both dueDay and dueWithTime set to today', () => {
      const taskWithBoth = createMockTask({
        id: 'taskWithBoth',
        title: 'Both Due Day and Time',
        dueDay: today,
        dueWithTime: getTodayAtHour(15),
      });

      const mockState = createMockState(
        {
          ids: ['taskWithBoth'],
          entities: { taskWithBoth },
        },
        { days: {} },
      );

      const result = fromSelectors.selectAllTasksDueToday(mockState);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('taskWithBoth');
    });

    it('should work with different todayStr values', () => {
      // Use tomorrow as "today"
      const mockState = createMockState({}, {}, tomorrow);
      const result = fromSelectors.selectAllTasksDueToday(mockState);

      const ids = result.map((t) => t.id);
      expect(ids).toContain('taskDueTomorrow');
      expect(ids).not.toContain('taskDueToday');
    });

    describe('with startOfNextDayDiff offset', () => {
      const FOUR_HOURS_MS = 4 * 3600000;
      const offsetTodayStr = '2026-02-15';

      // Helper to create a local timestamp for a specific date and time
      const getLocalTimestamp = (
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number = 0,
      ): number => {
        return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
      };

      const createOffsetState = (
        tasks: { [id: string]: Task },
        startOfNextDayDiffMs: number = FOUR_HOURS_MS,
        todayStr: string = offsetTodayStr,
        plannerDays: { [day: string]: string[] } = {},
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      ) => ({
        [appStateFeatureKey]: { todayStr, startOfNextDayDiffMs },
        [TASK_FEATURE_NAME]: {
          ...mockTaskState,
          ids: Object.keys(tasks),
          entities: tasks,
        },
        [plannerFeatureKey]: {
          ...mockPlannerState,
          days: plannerDays,
        },
        [PROJECT_FEATURE_NAME]: { ids: [], entities: {} },
      });

      it('should include dueWithTime task at 2 AM next day when offset extends today', () => {
        // 2 AM Feb 16 minus 4h offset => Feb 15 22:00 => dateStr "2026-02-15" === todayStr
        const task = createMockTask({
          id: 'task2am',
          title: 'Due at 2 AM Feb 16',
          dueWithTime: getLocalTimestamp(2026, 2, 16, 2),
        });

        const mockState = createOffsetState({ task2am: task });
        const result = fromSelectors.selectAllTasksDueToday(mockState);

        const ids = result.map((t) => t.id);
        expect(ids).toContain('task2am');
      });

      it('should NOT include dueWithTime task at 5 AM next day when offset is 4 hours', () => {
        // 5 AM Feb 16 minus 4h offset => Feb 16 01:00 => dateStr "2026-02-16" !== todayStr
        const task = createMockTask({
          id: 'task5am',
          title: 'Due at 5 AM Feb 16',
          dueWithTime: getLocalTimestamp(2026, 2, 16, 5),
        });

        const mockState = createOffsetState({ task5am: task });
        const result = fromSelectors.selectAllTasksDueToday(mockState);

        const ids = result.map((t) => t.id);
        expect(ids).not.toContain('task5am');
      });

      it('should include task with dueDay matching todayStr regardless of offset', () => {
        // dueDay comparison is a simple string match, unaffected by offset
        const task = createMockTask({
          id: 'taskDueDay',
          title: 'Due Day Feb 15',
          dueDay: '2026-02-15',
        });

        const mockState = createOffsetState({ taskDueDay: task });
        const result = fromSelectors.selectAllTasksDueToday(mockState);

        const ids = result.map((t) => t.id);
        expect(ids).toContain('taskDueDay');
      });

      it('should include dueWithTime task at 3:59 AM next day (boundary, just before offset)', () => {
        // 3:59 AM Feb 16 minus 4h => Feb 15 23:59 => dateStr "2026-02-15" === todayStr
        const task = createMockTask({
          id: 'task359am',
          title: 'Due at 3:59 AM Feb 16',
          dueWithTime: getLocalTimestamp(2026, 2, 16, 3, 59),
        });

        const mockState = createOffsetState({ task359am: task });
        const result = fromSelectors.selectAllTasksDueToday(mockState);

        const ids = result.map((t) => t.id);
        expect(ids).toContain('task359am');
      });

      it('should NOT include dueWithTime task at 4:00 AM next day (boundary, exactly at offset)', () => {
        // 4:00 AM Feb 16 minus 4h => Feb 16 00:00 => dateStr "2026-02-16" !== todayStr
        const task = createMockTask({
          id: 'task400am',
          title: 'Due at 4:00 AM Feb 16',
          dueWithTime: getLocalTimestamp(2026, 2, 16, 4, 0),
        });

        const mockState = createOffsetState({ task400am: task });
        const result = fromSelectors.selectAllTasksDueToday(mockState);

        const ids = result.map((t) => t.id);
        expect(ids).not.toContain('task400am');
      });
    });
  });
});

describe('Planner Selectors - selectPlannerDays across several days with offset', () => {
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  const FIFTY_NINE_MIN_MS = 59 * 60 * 1000;
  const days = ['2026-03-10', '2026-03-11', '2026-03-12'];

  const plannedTask = (id: string, dueWithTime: number): Task =>
    ({
      id,
      title: id,
      created: 0,
      isDone: false,
      subTaskIds: [],
      tagIds: [],
      projectId: 'p1',
      timeSpentOnDay: {},
      timeEstimate: 0,
      timeSpent: 0,
      attachments: [],
      dueWithTime,
    }) as Task;

  it('puts planned tasks into their logical day', () => {
    const tasks = [
      // 03:59 is still the previous logical day with a 4h offset
      plannedTask('A', getLocalTime(2026, 3, 11, 3) + FIFTY_NINE_MIN_MS),
      plannedTask('B', getLocalTime(2026, 3, 11, 10)),
      plannedTask('C', getLocalTime(2026, 3, 12, 4)),
      plannedTask('D', getLocalTime(2026, 3, 11, 9)),
    ];

    const result = fromSelectors
      .selectPlannerDays(
        days,
        [],
        [],
        tasks as Parameters<typeof fromSelectors.selectPlannerDays>[3],
        '2026-03-09',
      )
      .projector(
        new Map(tasks.map((t) => [t.id, t])),
        { days: {}, addPlannedTasksDialogLastShown: undefined },
        {
          isWorkStartEndEnabled: false,
          workStart: '09:00',
          workEnd: '17:00',
          isLunchBreakEnabled: false,
          lunchBreakStart: '12:00',
          lunchBreakEnd: '13:00',
        },
        FOUR_HOURS_MS,
      );

    expect(result.map((d) => d.scheduledIItems.map((si) => si.id))).toEqual([
      ['A'],
      ['D', 'B'],
      ['C'],
    ]);
  });
});
