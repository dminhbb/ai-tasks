import { describe, expect, it } from 'vitest';
import { makeSubtask } from '@/test/taskFactory';
import { setSubtaskWorkHours, toggleSubtaskCompletion, WORK_HOUR_OPTIONS } from '@/utils/subtaskWork';

describe('subtask work log', () => {
  it('offers even hour values from 0 through 24', () => {
    expect(WORK_HOUR_OPTIONS).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
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

  it('rejects unsupported hour values', () => {
    expect(() => setSubtaskWorkHours(makeSubtask(), 3)).toThrow(RangeError);
  });
});
