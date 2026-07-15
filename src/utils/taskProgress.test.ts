import { describe, expect, it } from 'vitest';
import { makeSubtask, makeTask } from '@/test/taskFactory';
import { applyManualProgress, clampProgress, getTaskProgress, syncTaskProgress } from '@/utils/taskProgress';

describe('task progress', () => {
  it('derives progress from subtasks', () => {
    const task = makeTask({ subtasks: [makeSubtask({ completed: true }), makeSubtask()] });
    expect(getTaskProgress(task)).toBe(50);
    expect(syncTaskProgress(task).progress).toBe(50);
  });

  it('maps manual completion to Done', () => {
    expect(applyManualProgress(makeTask(), 100).status).toBe('DONE');
    expect(applyManualProgress(makeTask(), 40).status).toBe('IN PROGRESS');
    expect(clampProgress('invalid')).toBe(0);
    expect(clampProgress(120)).toBe(100);
  });
});
