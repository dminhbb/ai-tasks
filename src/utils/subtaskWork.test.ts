import { describe, expect, it } from 'vitest';
import { makeSubtask } from '@/test/taskFactory';
import {
  cycleSubtaskStatus,
  setSubtaskWorkHours,
  toggleSubtaskCompletion,
  WORK_HOUR_OPTIONS,
} from '@/utils/subtaskWork';

describe('subtask work log', () => {
  it('offers short work values before the standard two-hour increments', () => {
    expect(WORK_HOUR_OPTIONS).toEqual([0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
  });

  it('records completion time and clears hours when reopened', () => {
    const completed = toggleSubtaskCompletion(makeSubtask(), '2026-07-15T08:00:00.000Z');
    const logged = setSubtaskWorkHours(completed, 6);
    expect(logged.completedAt).toBe('2026-07-15T08:00:00.000Z');
    expect(toggleSubtaskCompletion(logged, 'unused')).toMatchObject({
      completed: false,
      completedAt: null,
      workHours: 0,
    });
  });

  it('cycles through To Do, In Progress, Done and back to To Do', () => {
    const started = cycleSubtaskStatus(makeSubtask(), '2026-07-15T08:00:00.000Z');
    const completed = cycleSubtaskStatus(started, '2026-07-15T09:00:00.000Z');
    const reset = cycleSubtaskStatus(completed, 'unused');

    expect(started).toMatchObject({ status: 'IN PROGRESS', completed: false, completedAt: null });
    expect(completed).toMatchObject({
      status: 'DONE',
      completed: true,
      completedAt: '2026-07-15T09:00:00.000Z',
    });
    expect(reset).toMatchObject({
      status: 'TO DO',
      completed: false,
      completedAt: null,
      workHours: 0,
    });
  });

  it('rejects unsupported hour values', () => {
    expect(() => setSubtaskWorkHours(makeSubtask(), 1.5)).toThrow(RangeError);
  });
});
