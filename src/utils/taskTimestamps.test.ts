import { describe, expect, it } from 'vitest';
import { makeTask } from '@/test/taskFactory';
import { applyTaskTimestamps } from '@/utils/taskTimestamps';

describe('task timestamps', () => {
  it('records transitions without replacing the creation time', () => {
    const previous = makeTask({ id: 'task', createdAt: '2026-01-01T00:00:00.000Z' });
    const next = makeTask({ id: 'task', createdAt: '', status: 'IN PROGRESS' });
    const [result] = applyTaskTimestamps([next], [previous], '2026-07-15T12:00:00.000Z');
    expect(result.createdAt).toBe(previous.createdAt);
    expect(result.inProgressAt).toBe('2026-07-15T12:00:00.000Z');
  });
});
