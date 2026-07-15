import type { Subtask, Task } from '@/types';
import { isTodayTask, TODAY_TASK_TITLE } from '@/utils/taskOrdering';

export const MAX_BATCH_SUBTASKS = 100;
export const MAX_SUBTASK_TITLE_LENGTH = 500;
export const MAX_BATCH_TEXT_LENGTH = MAX_BATCH_SUBTASKS * (MAX_SUBTASK_TITLE_LENGTH + 2);

export function parseBatchSubtaskTitles(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, MAX_SUBTASK_TITLE_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_BATCH_SUBTASKS);
}

export function addBatchSubtasksToTodayTask(
  tasks: Task[],
  titles: string[],
  createId: () => string = () => crypto.randomUUID(),
  nowIso = new Date().toISOString()
): Task[] {
  if (titles.length === 0) return tasks;

  const todayTask = tasks.find(isTodayTask);
  const nextSubtaskSortOrder = todayTask
    ? Math.max(
        -1,
        ...todayTask.subtasks.map((subtask) => (Number.isFinite(subtask.sortOrder) ? subtask.sortOrder! : -1))
      ) + 1
    : 0;
  const newSubtasks: Subtask[] = titles.map((title, index) => ({
    id: createId(),
    title,
    completed: false,
    isToday: true,
    completedAt: null,
    workHours: 0,
    sortOrder: nextSubtaskSortOrder + index,
  }));

  if (todayTask) {
    return tasks.map((task) =>
      task.id === todayTask.id
        ? {
            ...task,
            status: task.status === 'DONE' || task.status === 'CANCELLED' ? 'TO DO' : task.status,
            subtasks: [...task.subtasks, ...newSubtasks],
          }
        : task
    );
  }

  return [
    {
      id: createId(),
      createdAt: nowIso,
      inProgressAt: null,
      doneAt: null,
      title: TODAY_TASK_TITLE,
      details: 'Task created automatically for uncategorized Today batch entries.',
      assignee: '',
      tags: [],
      status: 'TO DO',
      progress: 0,
      sortOrder: 0,
      startDate: null,
      dueDate: null,
      dueDateChangeCount: 0,
      notes: '',
      subtasks: newSubtasks,
    },
    ...tasks,
  ];
}
