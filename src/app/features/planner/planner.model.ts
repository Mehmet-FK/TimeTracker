import { TaskCopy } from '../tasks/task.model';
import { TaskRepeatCfg } from '../task-repeat-cfg/task-repeat-cfg.model';

export enum ScheduleItemType {
  Task = 'Task',
  RepeatProjection = 'RepeatProjection',
}

export interface PlannerDay {
  isToday?: boolean;
  dayDate: string;
  timeEstimate: number;
  timeLimit: number;
  itemsTotal: number;
  tasks: TaskCopy[];
  deadlineTasks: TaskCopy[];
  noStartTimeRepeatProjections: NoStartTimeRepeatProjection[];
  scheduledIItems: ScheduleItem[];
  availableHours?: number;
  progressPercentage?: number;
}

export interface PlannerDayMap {
  [dayDate: string]: TaskCopy[];
}

export interface NoStartTimeRepeatProjection {
  id: string;
  repeatCfg: TaskRepeatCfg;
}

export interface ScheduleItemBase {
  id: string;
  type: ScheduleItemType;
  start: number;
  end: number;
}

export interface ScheduleItemTask extends ScheduleItemBase {
  type: ScheduleItemType.Task;
  task: TaskCopy;
}

export interface ScheduleItemRepeatProjection extends ScheduleItemBase {
  type: ScheduleItemType.RepeatProjection;
  repeatCfg: TaskRepeatCfg;
}

export type ScheduleItem = ScheduleItemTask | ScheduleItemRepeatProjection;

export const ADD_TASK_PANEL_ID = 'ADD_TASK_PANEL' as const;
export const OVERDUE_LIST_ID = 'OVERDUE_LIST' as const;
