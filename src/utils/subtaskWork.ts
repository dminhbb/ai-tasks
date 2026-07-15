import type { Subtask, SubtaskStatus } from '@/types';

export const MIN_WORK_HOURS = 0;
export const MAX_WORK_HOURS = 24;
export const WORK_HOUR_STEP = 2;
export const SHORT_WORK_HOUR_OPTIONS = [MIN_WORK_HOURS, 0.5, 1, 2, 3] as const;
export const WORK_HOUR_OPTIONS = [
  ...SHORT_WORK_HOUR_OPTIONS,
  ...Array.from(
    { length: (MAX_WORK_HOURS - 4) / WORK_HOUR_STEP + 1 },
    (_, index) => 4 + index * WORK_HOUR_STEP
  ),
];

const NEXT_SUBTASK_STATUS: Record<SubtaskStatus, SubtaskStatus> = {
  'TO DO': 'IN PROGRESS',
  'IN PROGRESS': 'DONE',
  DONE: 'TO DO',
};

export function setSubtaskStatus(subtask: Subtask, status: SubtaskStatus, completedAt: string): Subtask {
  const completed = status === 'DONE';
  return {
    ...subtask,
    status,
    completed,
    completedAt: completed ? (subtask.completedAt ?? completedAt) : null,
    workHours: completed ? subtask.workHours : MIN_WORK_HOURS,
  };
}

export function cycleSubtaskStatus(subtask: Subtask, completedAt: string): Subtask {
  return setSubtaskStatus(subtask, NEXT_SUBTASK_STATUS[subtask.status], completedAt);
}

export function toggleSubtaskCompletion(subtask: Subtask, completedAt: string): Subtask {
  return setSubtaskStatus(subtask, subtask.completed ? 'TO DO' : 'DONE', completedAt);
}

export function setSubtaskWorkHours(subtask: Subtask, workHours: number): Subtask {
  if (!WORK_HOUR_OPTIONS.includes(workHours)) {
    throw new RangeError('Work hours must be one of the supported values from 0 to 24.');
  }
  return { ...subtask, workHours };
}
