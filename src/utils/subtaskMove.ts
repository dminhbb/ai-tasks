import type { Task, TaskStatus } from '@/types';

export const ALL_TASK_FILTER_VALUE = 'ALL';
export type TaskStatusFilter = typeof ALL_TASK_FILTER_VALUE | TaskStatus;

interface MoveTargetFilters {
  sourceTaskId: string | null;
  query: string;
  tag: string;
  status: TaskStatusFilter;
}

export function filterMoveTargetTasks(tasks: Task[], filters: MoveTargetFilters): Task[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    if (task.id === filters.sourceTaskId) return false;
    if (filters.tag !== ALL_TASK_FILTER_VALUE && !task.tags.includes(filters.tag)) return false;
    if (filters.status !== ALL_TASK_FILTER_VALUE && task.status !== filters.status) return false;
    if (!normalizedQuery) return true;
    return [task.title, task.details, task.assignee, task.status, ...task.tags]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
}
