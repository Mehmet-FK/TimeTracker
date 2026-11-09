import { Task } from '../../tasks/task.model';

export const MAX_TASK_OPTIONS = 30;

/** Only tasks without sub tasks hold time themselves. */
export const getLeafTasks = (tasks: Task[]): Task[] =>
  tasks.filter((t) => !t.subTaskIds.length);

/** Leaf tasks whose title contains the query (all without a query), limited in count. */
export const filterLeafTasks = (tasks: Task[], query: string): Task[] => {
  const q = query.trim().toLowerCase();
  const leafTasks = getLeafTasks(tasks);
  return (
    q ? leafTasks.filter((t) => t.title.toLowerCase().includes(q)) : leafTasks
  ).slice(0, MAX_TASK_OPTIONS);
};
