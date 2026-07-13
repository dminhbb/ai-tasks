import type { Task } from '@/types';

export const MANUAL_PROGRESS_OPTIONS = [0, 20, 40, 60, 80, 100] as const;

export function clampProgress(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function getTaskProgress(task: Pick<Task, 'progress' | 'subtasks'>): number {
  const subtasks = task.subtasks || [];
  if (subtasks.length === 0) return clampProgress(task.progress);

  const completed = subtasks.filter((subtask) => subtask.completed).length;
  return clampProgress((completed / subtasks.length) * 100);
}

export function syncTaskProgress(task: Task): Task {
  const progress = getTaskProgress(task);
  return { ...task, progress };
}

export function applyManualProgress(task: Task, value: number): Task {
  const progress = clampProgress(value);
  if (progress >= 100) return { ...task, progress, status: 'DONE' };
  if (progress > 0) return { ...task, progress, status: 'IN PROGRESS' };
  return { ...task, progress };
}

export function applyProgressRules(tasks: Task[]): Task[] {
  return tasks.map(syncTaskProgress);
}
