import { describe, expect, it } from 'vitest';
import { makeSubtask, makeTask } from '@/test/taskFactory';
import {
  getTodaySubtaskItems,
  getSuggestedTodaySubtaskItems,
  isVisibleTodaySubtask,
  reorderSubtasksWithinTask,
  reorderTodaySubtasks,
} from '@/utils/todayTasks';

const NOW = new Date('2026-07-15T12:00:00.000Z').getTime();

describe('Today task rules', () => {
  it('keeps recent completed Today subtasks and hides old ones', () => {
    expect(isVisibleTodaySubtask(makeSubtask({ isToday: true }), NOW)).toBe(true);
    expect(
      isVisibleTodaySubtask(
        makeSubtask({
          isToday: true,
          status: 'DONE',
          completed: true,
          completedAt: '2026-07-13T12:00:00.000Z',
        }),
        NOW
      )
    ).toBe(true);
    expect(
      isVisibleTodaySubtask(
        makeSubtask({
          isToday: true,
          status: 'DONE',
          completed: true,
          completedAt: '2026-07-10T12:00:00.000Z',
        }),
        NOW
      )
    ).toBe(false);
  });

  it('suggests one highest-priority incomplete subtask per upcoming task', () => {
    const task = makeTask({
      dueDate: '2026-07-20T00:00:00.000Z',
      subtasks: [
        makeSubtask({ id: 'later', sortOrder: 2 }),
        makeSubtask({ id: 'first', sortOrder: 0 }),
        makeSubtask({ id: 'done', sortOrder: 1, status: 'DONE', completed: true }),
      ],
    });
    expect(getSuggestedTodaySubtaskItems([task], NOW).map((item) => item.subtask.id)).toEqual(['first']);
  });

  it('excludes completed tasks and tasks outside the due window from suggestions', () => {
    const done = makeTask({ status: 'DONE', dueDate: '2026-07-16T00:00:00.000Z', subtasks: [makeSubtask()] });
    const future = makeTask({ dueDate: '2026-08-01T00:00:00.000Z', subtasks: [makeSubtask()] });
    expect(getSuggestedTodaySubtaskItems([done, future], NOW)).toEqual([]);
  });

  it('sorts Today items and persists a cross-task reorder', () => {
    const first = makeTask({
      id: 'task-one',
      subtasks: [makeSubtask({ id: 'one', isToday: true, sortOrder: 0 })],
    });
    const second = makeTask({
      id: 'task-two',
      subtasks: [makeSubtask({ id: 'two', isToday: true, sortOrder: 1 })],
    });
    const items = getTodaySubtaskItems([second, first], NOW);
    expect(items.map((item) => item.subtask.id)).toEqual(['one', 'two']);
    const reordered = reorderTodaySubtasks([first, second], items, 'two', 'one');
    expect(reordered.find((task) => task.id === 'task-two')?.subtasks[0].sortOrder).toBe(0);
    expect(reordered.find((task) => task.id === 'task-one')?.subtasks[0].sortOrder).toBe(1);
  });

  it('places completed Today subtasks after incomplete subtasks', () => {
    const task = makeTask({
      subtasks: [
        makeSubtask({
          id: 'done',
          isToday: true,
          sortOrder: 0,
          status: 'DONE',
          completed: true,
          completedAt: '2026-07-15T10:00:00.000Z',
        }),
        makeSubtask({ id: 'open', isToday: true, sortOrder: 1 }),
      ],
    });

    expect(getTodaySubtaskItems([task], NOW).map((item) => item.subtask.id)).toEqual(['open', 'done']);
  });

  it('orders Today subtasks by To Do, In Progress, then Done', () => {
    const task = makeTask({
      subtasks: [
        makeSubtask({
          id: 'done',
          isToday: true,
          sortOrder: 0,
          status: 'DONE',
          completed: true,
          completedAt: '2026-07-15T10:00:00.000Z',
        }),
        makeSubtask({ id: 'progress', isToday: true, sortOrder: 1, status: 'IN PROGRESS' }),
        makeSubtask({ id: 'todo', isToday: true, sortOrder: 2, status: 'TO DO' }),
      ],
    });

    expect(getTodaySubtaskItems([task], NOW).map((item) => item.subtask.id)).toEqual([
      'todo',
      'progress',
      'done',
    ]);
  });

  it('reorders and normalizes subtasks', () => {
    const result = reorderSubtasksWithinTask(
      [makeSubtask({ id: 'one', sortOrder: 0 }), makeSubtask({ id: 'two', sortOrder: 1 })],
      'two',
      'one'
    );
    expect(result.map((subtask) => subtask.id)).toEqual(['two', 'one']);
    expect(result.map((subtask) => subtask.sortOrder)).toEqual([0, 1]);
  });
});
