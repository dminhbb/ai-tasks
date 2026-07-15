import type { Subtask } from '@/types';

export const MIN_WORK_HOURS = 0;
export const MAX_WORK_HOURS = 24;
export const WORK_HOUR_STEP = 2;
export const WORK_HOUR_OPTIONS = Array.from(
  { length: (MAX_WORK_HOURS - MIN_WORK_HOURS) / WORK_HOUR_STEP + 1 },
  (_, index) => MIN_WORK_HOURS + index * WORK_HOUR_STEP
);

export function toggleSubtaskCompletion(subtask: Subtask, completedAt: string): Subtask {
  if (subtask.completed) {
    return { ...subtask, completed: false, completedAt: null, workHours: MIN_WORK_HOURS };
  }
  return { ...subtask, completed: true, completedAt, workHours: subtask.workHours };
}

export function setSubtaskWorkHours(subtask: Subtask, workHours: number): Subtask {
  if (!WORK_HOUR_OPTIONS.includes(workHours)) {
    throw new RangeError('Work hours must be an even number from 0 to 24.');
  }
  return { ...subtask, workHours };
}
