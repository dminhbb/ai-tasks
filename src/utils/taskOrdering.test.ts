import { describe, expect, it } from 'vitest';
import { makeSubtask, makeTask } from '@/test/taskFactory';
import {
  compareTaskListOrder,
  isTodayTask,
  normalizeSubtaskSortOrders,
  reorderTasksWithinStatus,
  TODAY_TASK_TITLE,
} from '@/utils/taskOrdering';

describe('task ordering', () => {
  it('pins the special Today task before urgent tasks', () => {
    const todayTask = makeTask({ title: TODAY_TASK_TITLE, status: 'TO DO' });
    const urgentTask = makeTask({ title: 'Urgent', status: 'URGENT' });
    expect([urgentTask, todayTask].sort(compareTaskListOrder)[0]).toBe(todayTask);
    expect(isTodayTask(todayTask)).toBe(true);
  });

  it('reorders only tasks in the same status', () => {
    const first = makeTask({ id: 'first', sortOrder: 0 });
    const second = makeTask({ id: 'second', sortOrder: 1 });
    const urgent = makeTask({ id: 'urgent', status: 'URGENT' });
    const result = reorderTasksWithinStatus([first, second, urgent], 'second', 'first');
    expect(result.find((task) => task.id === 'second')?.sortOrder).toBe(0);
    expect(result.find((task) => task.id === 'urgent')).toEqual(urgent);
  });

  it('normalizes subtask priorities', () => {
    const result = normalizeSubtaskSortOrders([makeSubtask({ sortOrder: 8 }), makeSubtask({ sortOrder: 3 })]);
    expect(result.map((subtask) => subtask.sortOrder)).toEqual([0, 1]);
  });
});
