import { describe, expect, it } from 'vitest';
import { makeTask } from '@/test/taskFactory';
import { TODAY_TASK_TITLE } from '@/utils/taskOrdering';
import { addBatchSubtasksToTodayTask, parseBatchSubtaskTitles } from '@/utils/todayBatch';

describe('Today batch add', () => {
  it('trims lines and ignores empty entries', () => {
    expect(parseBatchSubtaskTitles(' First \n\n Second ')).toEqual(['First', 'Second']);
  });

  it('creates the pinned special task with Today subtasks', () => {
    let id = 0;
    const result = addBatchSubtasksToTodayTask(
      [makeTask({ id: 'existing' })],
      ['One', 'Two'],
      () => `generated-${++id}`,
      '2026-07-15T12:00:00.000Z'
    );
    expect(result[0].title).toBe(TODAY_TASK_TITLE);
    expect(result[0].subtasks.map((subtask) => subtask.title)).toEqual(['One', 'Two']);
    expect(result[0].subtasks.every((subtask) => subtask.isToday)).toBe(true);
  });

  it('reuses and reactivates an existing special task', () => {
    const existing = makeTask({ id: 'today', title: TODAY_TASK_TITLE, status: 'DONE' });
    const result = addBatchSubtasksToTodayTask([existing], ['New'], () => 'subtask');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('TO DO');
    expect(result[0].subtasks[0].id).toBe('subtask');
  });

  it('does not change tasks for an empty batch', () => {
    const tasks = [makeTask()];
    expect(addBatchSubtasksToTodayTask(tasks, [])).toBe(tasks);
  });
});
