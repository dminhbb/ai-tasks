import type { Subtask, Task } from '@/types';
import { compareSubtaskOrder } from '@/utils/taskOrdering';

const COMPLETED_VISIBILITY_DAYS = 3;
const TODAY_FLAG_EXPIRY_DAYS = 7;
const SUGGESTION_DUE_WINDOW_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SUBTASK_STATUS_ORDER: Record<Subtask['status'], number> = {
  'TO DO': 0,
  'IN PROGRESS': 1,
  WARNING: 2,
  WAITING: 3,
  PENDING: 4,
  CANCELLED: 5,
  DONE: 6,
};

export interface TodaySubtaskItem {
  task: Task;
  subtask: Subtask;
  suggested: boolean;
}

export interface SubtaskReference {
  taskId: string;
  subtaskId: string;
}

export function isVisibleTodaySubtask(subtask: Subtask, now: number): boolean {
  if (!subtask.isToday) return false;
  if (!subtask.completed) return true;
  if (!subtask.completedAt) return false;

  const completedTime = new Date(subtask.completedAt).getTime();
  if (Number.isNaN(completedTime)) return false;
  return now - completedTime <= COMPLETED_VISIBILITY_DAYS * MILLISECONDS_PER_DAY;
}

export interface ClearExpiredTodayFlagsResult {
  tasks: Task[];
  changed: boolean;
}

export function clearExpiredTodayFlags(tasks: Task[], now: number): ClearExpiredTodayFlagsResult {
  let changed = false;

  const nextTasks = tasks.map((task) => {
    let taskChanged = false;
    const subtasks = task.subtasks.map((subtask) => {
      if (!subtask.isToday || !subtask.completed || !subtask.completedAt) return subtask;

      const completedTime = new Date(subtask.completedAt).getTime();
      if (Number.isNaN(completedTime)) return subtask;
      if (now - completedTime < TODAY_FLAG_EXPIRY_DAYS * MILLISECONDS_PER_DAY) return subtask;

      taskChanged = true;
      return { ...subtask, isToday: false };
    });

    if (!taskChanged) return task;
    changed = true;
    return { ...task, subtasks };
  });

  return changed ? { tasks: nextTasks, changed: true } : { tasks, changed: false };
}

function compareByDueDate(left: TodaySubtaskItem, right: TodaySubtaskItem): number {
  const leftTime = left.subtask.dueDate ? new Date(left.subtask.dueDate).getTime() : NaN;
  const rightTime = right.subtask.dueDate ? new Date(right.subtask.dueDate).getTime() : NaN;
  const leftValid = !Number.isNaN(leftTime);
  const rightValid = !Number.isNaN(rightTime);

  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return leftTime - rightTime;
}

export type TodaySortCriteria = 'status' | 'dueDate' | 'assignee' | 'parentTask';

export function compareTodaySubtaskItemsBy(
  criteria: TodaySortCriteria
): (left: TodaySubtaskItem, right: TodaySubtaskItem) => number {
  return (left, right) => {
    let primaryOrder = 0;
    switch (criteria) {
      case 'status':
        primaryOrder = SUBTASK_STATUS_ORDER[left.subtask.status] - SUBTASK_STATUS_ORDER[right.subtask.status];
        break;
      case 'assignee':
        primaryOrder = (left.subtask.assignee || '').localeCompare(right.subtask.assignee || '');
        break;
      case 'parentTask':
        primaryOrder = left.task.title.localeCompare(right.task.title);
        break;
      case 'dueDate':
        primaryOrder = 0;
        break;
    }
    if (primaryOrder !== 0) return primaryOrder;

    const dueDateOrder = compareByDueDate(left, right);
    if (dueDateOrder !== 0) return dueDateOrder;

    const subtaskOrder = compareSubtaskOrder(left.subtask, right.subtask);
    if (subtaskOrder !== 0) return subtaskOrder;
    return left.task.id.localeCompare(right.task.id);
  };
}

export function compareTodaySubtaskItems(left: TodaySubtaskItem, right: TodaySubtaskItem): number {
  return compareTodaySubtaskItemsBy('status')(left, right);
}

export function getTodaySubtaskItems(tasks: Task[], now: number): TodaySubtaskItem[] {
  return tasks
    .flatMap((task) =>
      task.subtasks
        .filter((subtask) => isVisibleTodaySubtask(subtask, now))
        .map((subtask) => ({ task, subtask, suggested: false }))
    )
    .sort(compareTodaySubtaskItems);
}

function isTaskDueForSuggestion(task: Task, now: number): boolean {
  if (!task.dueDate || task.status === 'DONE' || task.status === 'CANCELLED') return false;

  const dueTime = new Date(task.dueDate).getTime();
  if (Number.isNaN(dueTime)) return false;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dueWindowEnd = today.getTime() + (SUGGESTION_DUE_WINDOW_DAYS + 1) * MILLISECONDS_PER_DAY - 1;
  return dueTime <= dueWindowEnd;
}

export function getSuggestedTodaySubtaskItems(tasks: Task[], now: number): TodaySubtaskItem[] {
  return tasks
    .filter((task) => isTaskDueForSuggestion(task, now))
    .flatMap((task) => {
      const subtask = [...task.subtasks]
        .sort(compareSubtaskOrder)
        .find((candidate) => !candidate.completed && !candidate.isToday);
      return subtask ? [{ task, subtask, suggested: true }] : [];
    })
    .sort(compareTodaySubtaskItems);
}

export function reorderSubtasksWithinTask(
  subtasks: Subtask[],
  draggedSubtaskId: string,
  targetSubtaskId: string
): Subtask[] {
  if (draggedSubtaskId === targetSubtaskId) return subtasks;

  const ordered = [...subtasks].sort(compareSubtaskOrder);
  const dragged = ordered.find((subtask) => subtask.id === draggedSubtaskId);
  if (!dragged) return subtasks;

  const withoutDragged = ordered.filter((subtask) => subtask.id !== draggedSubtaskId);
  const targetIndex = withoutDragged.findIndex((subtask) => subtask.id === targetSubtaskId);
  if (targetIndex === -1) return subtasks;

  withoutDragged.splice(targetIndex, 0, dragged);
  return withoutDragged.map((subtask, index) => ({ ...subtask, sortOrder: index }));
}

export function reorderTodaySubtasks(
  tasks: Task[],
  orderedItems: TodaySubtaskItem[],
  draggedSubtaskId: string,
  targetSubtaskId: string
): Task[] {
  if (draggedSubtaskId === targetSubtaskId) return tasks;

  const dragged = orderedItems.find((item) => item.subtask.id === draggedSubtaskId);
  if (!dragged) return tasks;

  const reorderedItems = orderedItems.filter((item) => item.subtask.id !== draggedSubtaskId);
  const targetIndex = reorderedItems.findIndex((item) => item.subtask.id === targetSubtaskId);
  if (targetIndex === -1) return tasks;

  reorderedItems.splice(targetIndex, 0, dragged);
  const priorityBySubtaskId = new Map(reorderedItems.map((item, index) => [item.subtask.id, index]));

  return tasks.map((task) => ({
    ...task,
    subtasks: task.subtasks.map((subtask) => {
      const sortOrder = priorityBySubtaskId.get(subtask.id);
      return sortOrder === undefined ? subtask : { ...subtask, sortOrder };
    }),
  }));
}
