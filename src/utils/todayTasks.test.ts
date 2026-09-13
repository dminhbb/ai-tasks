import { describe, expect, it } from 'vitest';
import { makeSubtask, makeTask } from '@/test/taskFactory';
import {
  clearExpiredTodayFlags,
  compareTodaySubtaskItemsBy,
  getTodaySubtaskItems,
  getSuggestedTodaySubtaskItems,
  isVisibleTodaySubtask,
  reorderSubtasksWithinTask,
  reorderTodaySubtasks,
} from '@/utils/todayTasks';
import type { TodaySubtaskItem } from '@/utils/todayTasks';

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

  it('clears the Today flag once a completed subtask has been done for a week or more', () => {
    const stillWithinWeek = makeTask({
      id: 'recent',
      subtasks: [
        makeSubtask({ id: 'recent-sub', isToday: true, completed: true, completedAt: '2026-07-09T12:00:00.000Z' }),
      ],
    });
    const overAWeek = makeTask({
      id: 'stale',
      subtasks: [
        makeSubtask({ id: 'stale-sub', isToday: true, completed: true, completedAt: '2026-07-08T12:00:00.000Z' }),
      ],
    });
    const notCompleted = makeTask({
      id: 'open',
      subtasks: [makeSubtask({ id: 'open-sub', isToday: true, completed: false })],
    });

    const result = clearExpiredTodayFlags([stillWithinWeek, overAWeek, notCompleted], NOW);

    expect(result.changed).toBe(true);
    expect(result.tasks.find((task) => task.id === 'recent')?.subtasks[0].isToday).toBe(true);
    expect(result.tasks.find((task) => task.id === 'stale')?.subtasks[0].isToday).toBe(false);
    expect(result.tasks.find((task) => task.id === 'open')?.subtasks[0].isToday).toBe(true);
  });

  it('reports no change and returns the same array when nothing has expired', () => {
    const tasks = [makeTask({ subtasks: [makeSubtask({ isToday: true })] })];
    const result = clearExpiredTodayFlags(tasks, NOW);
    expect(result.changed).toBe(false);
    expect(result.tasks).toBe(tasks);
  });

  it('sorts by due date nearest-first within each status group by default', () => {
    const task = makeTask({
      subtasks: [
        makeSubtask({ id: 'later', isToday: true, sortOrder: 0, dueDate: '2026-07-20T00:00:00.000Z' }),
        makeSubtask({ id: 'no-due', isToday: true, sortOrder: 1, dueDate: null }),
        makeSubtask({ id: 'soonest', isToday: true, sortOrder: 2, dueDate: '2026-07-16T00:00:00.000Z' }),
      ],
    });
    const items: TodaySubtaskItem[] = task.subtasks.map((subtask) => ({ task, subtask, suggested: false }));
    const sorted = [...items].sort(compareTodaySubtaskItemsBy('status'));
    expect(sorted.map((item) => item.subtask.id)).toEqual(['soonest', 'later', 'no-due']);
  });

  it('sorts purely by due date when the dueDate criteria is chosen', () => {
    const taskA = makeTask({ id: 'a', subtasks: [makeSubtask({ id: 'a-sub', dueDate: '2026-07-18T00:00:00.000Z' })] });
    const taskB = makeTask({ id: 'b', subtasks: [makeSubtask({ id: 'b-sub', dueDate: '2026-07-16T00:00:00.000Z' })] });
    const items: TodaySubtaskItem[] = [
      { task: taskA, subtask: taskA.subtasks[0], suggested: false },
      { task: taskB, subtask: taskB.subtasks[0], suggested: false },
    ];
    const sorted = [...items].sort(compareTodaySubtaskItemsBy('dueDate'));
    expect(sorted.map((item) => item.subtask.id)).toEqual(['b-sub', 'a-sub']);
  });

  it('groups by assignee, then by parent task, before falling back to due date', () => {
    const taskA = makeTask({
      id: 'task-a',
      title: 'Alpha',
      subtasks: [makeSubtask({ id: 'alice-sub', assignee: 'Alice', dueDate: null })],
    });
    const taskB = makeTask({
      id: 'task-b',
      title: 'Beta',
      subtasks: [makeSubtask({ id: 'bob-sub', assignee: 'Bob', dueDate: null })],
    });
    const items: TodaySubtaskItem[] = [
      { task: taskB, subtask: taskB.subtasks[0], suggested: false },
      { task: taskA, subtask: taskA.subtasks[0], suggested: false },
    ];

    const byAssignee = [...items].sort(compareTodaySubtaskItemsBy('assignee'));
    expect(byAssignee.map((item) => item.subtask.id)).toEqual(['alice-sub', 'bob-sub']);

    const byParentTask = [...items].sort(compareTodaySubtaskItemsBy('parentTask'));
    expect(byParentTask.map((item) => item.subtask.id)).toEqual(['alice-sub', 'bob-sub']);
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
