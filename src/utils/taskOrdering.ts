import type { Subtask, Task, TaskStatus } from '@/types';

export const STATUS_ORDER: Record<TaskStatus, number> = {
  'URGENT': 0,
  'IN PROGRESS': 1,
  'TO DO': 2,
  'PENDING': 3,
  'CANCELLED': 4,
  'DONE': 5,
};

export function compareTaskPriority(a: Task, b: Task) {
  const aOrder = Number.isFinite(a.sortOrder) ? a.sortOrder! : Number.MAX_SAFE_INTEGER;
  const bOrder = Number.isFinite(b.sortOrder) ? b.sortOrder! : Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  const aTags = a.tags.join(',');
  const bTags = b.tags.join(',');
  if (aTags !== bTags) return aTags.localeCompare(bTags);
  if (a.assignee !== b.assignee) return (a.assignee || '').localeCompare(b.assignee || '');
  if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.id - b.id;
}

export function compareTaskListOrder(a: Task, b: Task) {
  const aStatusSort = STATUS_ORDER[a.status];
  const bStatusSort = STATUS_ORDER[b.status];
  if (aStatusSort !== bStatusSort) return aStatusSort - bStatusSort;
  return compareTaskPriority(a, b);
}

export function compareSubtaskOrder(a: Subtask, b: Subtask) {
  const aOrder = Number.isFinite(a.sortOrder) ? a.sortOrder! : Number.MAX_SAFE_INTEGER;
  const bOrder = Number.isFinite(b.sortOrder) ? b.sortOrder! : Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.id - b.id;
}

export function reorderTasksWithinStatus(tasks: Task[], draggedTaskId: number, targetTaskId: number) {
  const draggedTask = tasks.find((task) => task.id === draggedTaskId);
  const targetTask = tasks.find((task) => task.id === targetTaskId);
  if (!draggedTask || !targetTask || draggedTask.status !== targetTask.status || draggedTask.id === targetTask.id) {
    return tasks;
  }

  const statusTasks = tasks
    .filter((task) => task.status === targetTask.status)
    .sort(compareTaskPriority)
    .filter((task) => task.id !== draggedTask.id);
  const targetIndex = statusTasks.findIndex((task) => task.id === targetTask.id);
  if (targetIndex === -1) return tasks;

  statusTasks.splice(targetIndex, 0, draggedTask);
  const reorderedById = new Map(statusTasks.map((task, index) => [task.id, { ...task, sortOrder: index }]));

  return tasks.map((task) => reorderedById.get(task.id) || task);
}

export function normalizeSubtaskSortOrders(subtasks: Subtask[]) {
  return subtasks.map((subtask, index) => ({ ...subtask, sortOrder: index }));
}
