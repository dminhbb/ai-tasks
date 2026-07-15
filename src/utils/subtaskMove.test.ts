import { describe, expect, it } from 'vitest';
import { makeTask } from '@/test/taskFactory';
import { ALL_TASK_FILTER_VALUE, filterMoveTargetTasks } from '@/utils/subtaskMove';

describe('subtask move target filtering', () => {
  const tasks = [
    makeTask({ id: 'source', title: '(Untitle Tasks)' }),
    makeTask({ id: 'report', title: 'Quarterly report', assignee: 'Minh', tags: ['Reporting'] }),
    makeTask({ id: 'bug', title: 'Fix login', status: 'URGENT', tags: ['Bug'] }),
  ];

  it('excludes the current parent task', () => {
    const result = filterMoveTargetTasks(tasks, {
      sourceTaskId: 'source',
      query: '',
      tag: ALL_TASK_FILTER_VALUE,
      status: ALL_TASK_FILTER_VALUE,
    });
    expect(result.map((task) => task.id)).toEqual(['report', 'bug']);
  });

  it('searches arbitrary task metadata and combines tag and status filters', () => {
    expect(
      filterMoveTargetTasks(tasks, {
        sourceTaskId: null,
        query: 'minh',
        tag: 'Reporting',
        status: 'TO DO',
      }).map((task) => task.id)
    ).toEqual(['report']);
  });
});
