import type { Subtask, Task } from '@/types';

export function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
  return {
    id: crypto.randomUUID(),
    title: 'Subtask',
    status: 'TO DO',
    completed: false,
    isToday: false,
    completedAt: null,
    workHours: 0,
    sortOrder: 0,
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    createdAt: '2026-07-15T00:00:00.000Z',
    inProgressAt: null,
    doneAt: null,
    title: 'Task',
    details: '',
    assignee: '',
    tags: [],
    status: 'TO DO',
    progress: 0,
    sortOrder: 0,
    startDate: null,
    dueDate: null,
    dueDateChangeCount: 0,
    notes: '',
    subtasks: [],
    ...overrides,
  };
}
