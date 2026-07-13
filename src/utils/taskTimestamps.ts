import type { Task } from '@/types';

export function applyTaskTimestamps(
  nextTasks: Task[],
  previousTasks: Task[] = [],
  nowIso = new Date().toISOString()
): Task[] {
  const previousById = new Map(previousTasks.map((task) => [task.id, task]));

  return nextTasks.map((task) => {
    const previous = previousById.get(task.id);
    const movedToInProgress = task.status === 'IN PROGRESS' && previous?.status !== 'IN PROGRESS';
    const movedToDone = task.status === 'DONE' && previous?.status !== 'DONE';

    return {
      ...task,
      createdAt: task.createdAt || previous?.createdAt || nowIso,
      inProgressAt: task.inProgressAt || previous?.inProgressAt || (movedToInProgress ? nowIso : null),
      doneAt: movedToDone ? nowIso : task.doneAt || previous?.doneAt || null,
    };
  });
}
