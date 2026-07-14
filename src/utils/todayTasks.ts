import type { Subtask, Task } from '@/types';
import { compareSubtaskOrder } from '@/utils/taskOrdering';

const COMPLETED_VISIBILITY_DAYS = 3;
const SUGGESTION_DUE_WINDOW_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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

function compareTodayItems(left: TodaySubtaskItem, right: TodaySubtaskItem): number {
  const subtaskOrder = compareSubtaskOrder(left.subtask, right.subtask);
  if (subtaskOrder !== 0) return subtaskOrder;
  return left.task.id.localeCompare(right.task.id);
}

export function getTodaySubtaskItems(tasks: Task[], now: number): TodaySubtaskItem[] {
  return tasks
    .flatMap((task) => task.subtasks
      .filter((subtask) => isVisibleTodaySubtask(subtask, now))
      .map((subtask) => ({ task, subtask, suggested: false })))
    .sort(compareTodayItems);
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
    .sort(compareTodayItems);
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
  const priorityBySubtaskId = new Map(
    reorderedItems.map((item, index) => [item.subtask.id, index])
  );

  return tasks.map((task) => ({
    ...task,
    subtasks: task.subtasks.map((subtask) => {
      const sortOrder = priorityBySubtaskId.get(subtask.id);
      return sortOrder === undefined ? subtask : { ...subtask, sortOrder };
    }),
  }));
}
