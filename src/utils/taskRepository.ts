import fs from 'fs';
import path from 'path';
import type { Subtask, Task, TaskStatus } from '@/types';
import { getDb } from './db';
import { readTasks as readLegacyCsvTasks } from './csv';
import { applyTaskTimestamps } from './taskTimestamps';
import { applyProgressRules, getTaskProgress } from './taskProgress';
import { resolveNotebookId } from './notebooks';
import { normalizeSubtaskSortOrders } from './taskOrdering';

const LEGACY_TASKS_FILE = path.join(process.cwd(), 'data', 'tasks.csv');
const TASK_STATUSES: TaskStatus[] = ['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE'];

type CountRow = { count: number };

type TaskRow = {
  id: number;
  notebook_id: number;
  title: string;
  details: string;
  assignee: string;
  status: string;
  progress: number;
  sort_order: number;
  start_date: string | null;
  due_date: string | null;
  notes: string;
  created_at: string;
  in_progress_at: string | null;
  done_at: string | null;
};

type SubtaskRow = {
  id: number;
  task_id: number;
  title: string;
  completed: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type TagRow = {
  task_id: number;
  tag: string;
};

type DueDateEventCountRow = {
  task_id: number;
  count: number;
};

function normalizeStatus(value: unknown): TaskStatus {
  return typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus)
    ? value as TaskStatus
    : 'TO DO';
}

function getTaskCount(notebookId: number) {
  const row = getDb().prepare<[number], CountRow>('SELECT COUNT(*) AS count FROM tasks WHERE notebook_id = ?').get(notebookId);
  return row?.count || 0;
}

function getTotalTaskCount() {
  const row = getDb().prepare<[], CountRow>('SELECT COUNT(*) AS count FROM tasks').get();
  return row?.count || 0;
}

async function migrateLegacyCsvIfNeeded(notebookId: number) {
  if (getTaskCount(notebookId) > 0 || getTotalTaskCount() > 0 || !fs.existsSync(LEGACY_TASKS_FILE)) return;

  const legacyTasks = await readLegacyCsvTasks();
  if (legacyTasks.length === 0) return;

  replaceTasksInDb(legacyTasks, notebookId, { inferMissingStatusTimestamps: false });
}

export async function readTasksFromDb(notebookIdInput?: number): Promise<Task[]> {
  const notebookId = resolveNotebookId(notebookIdInput);
  await migrateLegacyCsvIfNeeded(notebookId);

  const database = getDb();
  const taskRows = database.prepare<[number], TaskRow>(`
    SELECT id, notebook_id, title, details, assignee, status, progress, sort_order, start_date, due_date, notes,
           created_at, in_progress_at, done_at
    FROM tasks
    WHERE notebook_id = ?
    ORDER BY status ASC, sort_order ASC, id ASC
  `).all(notebookId);
  const subtaskRows = database.prepare<[number], SubtaskRow>(`
    SELECT id, task_id, title, completed, sort_order, created_at, updated_at
    FROM subtasks
    WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)
    ORDER BY task_id ASC, sort_order ASC, id ASC
  `).all(notebookId);
  const tagRows = database.prepare<[number], TagRow>(`
    SELECT task_id, tag
    FROM task_tags
    WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)
    ORDER BY task_id ASC, tag ASC
  `).all(notebookId);
  const dueDateEventCountRows = database.prepare<[number], DueDateEventCountRow>(`
    SELECT task_id, COUNT(*) AS count
    FROM task_due_date_events
    WHERE notebook_id = ?
    GROUP BY task_id
  `).all(notebookId);

  const subtasksByTaskId = new Map<number, Subtask[]>();
  for (const row of subtaskRows) {
    const current = subtasksByTaskId.get(row.task_id) || [];
    current.push({
      id: row.id,
      title: row.title,
      completed: row.completed === 1,
      sortOrder: row.sort_order,
    });
    subtasksByTaskId.set(row.task_id, current);
  }

  const tagsByTaskId = new Map<number, string[]>();
  for (const row of tagRows) {
    const current = tagsByTaskId.get(row.task_id) || [];
    current.push(row.tag);
    tagsByTaskId.set(row.task_id, current);
  }

  const dueDateChangeCountByTaskId = new Map<number, number>();
  for (const row of dueDateEventCountRows) {
    dueDateChangeCountByTaskId.set(row.task_id, row.count);
  }

  return taskRows.map((row) => {
    const task = {
      id: row.id,
      createdAt: row.created_at,
      inProgressAt: row.in_progress_at,
      doneAt: row.done_at,
      title: row.title,
      details: row.details,
      assignee: row.assignee,
      tags: tagsByTaskId.get(row.id) || [],
      status: normalizeStatus(row.status),
      progress: row.progress,
      sortOrder: row.sort_order,
      startDate: row.start_date,
      dueDate: row.due_date,
      dueDateChangeCount: dueDateChangeCountByTaskId.get(row.id) || 0,
      notes: row.notes,
      subtasks: subtasksByTaskId.get(row.id) || [],
    };

    return { ...task, progress: getTaskProgress(task) };
  });
}

export async function writeTasksToDb(tasks: Task[], notebookIdInput?: number): Promise<void> {
  const notebookId = resolveNotebookId(notebookIdInput);
  await migrateLegacyCsvIfNeeded(notebookId);
  replaceTasksInDb(tasks, notebookId);
}

function replaceTasksInDb(
  tasks: Task[],
  notebookId: number,
  options: { inferMissingStatusTimestamps: boolean } = { inferMissingStatusTimestamps: true }
) {
  const database = getDb();
  const transaction = database.transaction((nextTasks: Task[]) => {
    const nowIso = new Date().toISOString();
    const previousTasks = selectTasksForTimestamping(notebookId);
    const previousById = new Map(previousTasks.map((task) => [task.id, task]));
    const tasksWithProgress = applyProgressRules(nextTasks);
    const tasksWithTimestamps = options.inferMissingStatusTimestamps
      ? applyTaskTimestamps(tasksWithProgress, previousTasks, nowIso)
      : tasksWithProgress.map((task) => ({
          ...task,
          createdAt: task.createdAt || previousById.get(task.id)?.createdAt || nowIso,
          inProgressAt: task.inProgressAt || previousById.get(task.id)?.inProgressAt || null,
          doneAt: task.doneAt || previousById.get(task.id)?.doneAt || null,
        }));
    const orderedTasks = normalizeTaskSortOrders(tasksWithTimestamps);
    const nextIds = new Set(orderedTasks.map((task) => task.id));

    const deleteTask = database.prepare('DELETE FROM tasks WHERE id = ? AND notebook_id = ?');
    for (const previousTask of previousTasks) {
      if (!nextIds.has(previousTask.id)) {
        deleteTask.run(previousTask.id, notebookId);
      }
    }

    const upsertTask = database.prepare(`
      INSERT INTO tasks (
        id, title, details, assignee, status, progress, sort_order, start_date, due_date, notes,
        created_at, in_progress_at, done_at, updated_at, notebook_id
      ) VALUES (
        @id, @title, @details, @assignee, @status, @progress, @sortOrder, @startDate, @dueDate, @notes,
        @createdAt, @inProgressAt, @doneAt, @updatedAt, @notebookId
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        details = excluded.details,
        assignee = excluded.assignee,
        status = excluded.status,
        progress = excluded.progress,
        sort_order = excluded.sort_order,
        start_date = excluded.start_date,
        due_date = excluded.due_date,
        notes = excluded.notes,
        created_at = excluded.created_at,
        in_progress_at = excluded.in_progress_at,
        done_at = excluded.done_at,
        updated_at = excluded.updated_at
    `);
    const deleteSubtasks = database.prepare('DELETE FROM subtasks WHERE task_id = ?');
    const insertSubtask = database.prepare(`
      INSERT INTO subtasks (id, task_id, title, completed, sort_order, created_at, updated_at)
      VALUES (@id, @taskId, @title, @completed, @sortOrder, @createdAt, @updatedAt)
    `);
    const deleteTags = database.prepare('DELETE FROM task_tags WHERE task_id = ?');
    const insertTag = database.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES (?, ?)');
    const insertStatusEvent = database.prepare(`
      INSERT INTO task_status_events (notebook_id, task_id, from_status, to_status, changed_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertDueDateEvent = database.prepare(`
      INSERT INTO task_due_date_events (notebook_id, task_id, from_due_date, to_due_date, changed_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const task of orderedTasks) {
      const previousTask = previousById.get(task.id);
      const status = normalizeStatus(task.status);
      const createdAt = task.createdAt || previousTask?.createdAt || nowIso;

      upsertTask.run({
        id: task.id,
        title: task.title || 'Untitled',
        details: task.details || '',
        assignee: task.assignee || '',
        status,
        progress: getTaskProgress(task),
        sortOrder: Number.isFinite(task.sortOrder) ? task.sortOrder : 0,
        startDate: task.startDate || null,
        dueDate: task.dueDate || null,
        notes: task.notes || '',
        createdAt,
        inProgressAt: task.inProgressAt || null,
        doneAt: task.doneAt || null,
        updatedAt: nowIso,
        notebookId,
      });

      deleteSubtasks.run(task.id);
      for (const subtask of normalizeSubtaskSortOrders(task.subtasks || [])) {
        const title = subtask.title.trim();
        if (!title) continue;

        insertSubtask.run({
          id: subtask.id,
          taskId: task.id,
          title,
          completed: subtask.completed ? 1 : 0,
          sortOrder: Number.isFinite(subtask.sortOrder) ? subtask.sortOrder : 0,
          createdAt: createdAt,
          updatedAt: nowIso,
        });
      }

      deleteTags.run(task.id);
      for (const tag of task.tags || []) {
        const normalizedTag = tag.trim();
        if (normalizedTag) {
          insertTag.run(task.id, normalizedTag);
        }
      }

      if (!previousTask) {
        insertStatusEvent.run(notebookId, task.id, null, status, createdAt);
      } else if (previousTask.status !== status) {
        insertStatusEvent.run(notebookId, task.id, previousTask.status, status, nowIso);
      }

      const previousDueDate = previousTask?.dueDate || null;
      const nextDueDate = task.dueDate || null;
      if (previousTask && normalizeDueDateForComparison(previousDueDate) !== normalizeDueDateForComparison(nextDueDate)) {
        insertDueDateEvent.run(notebookId, task.id, previousDueDate, nextDueDate, nowIso);
      }
    }
  });

  transaction(tasks);
}

function normalizeDueDateForComparison(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoDateMatch ? isoDateMatch[1] : trimmed;
}

function selectTasksForTimestamping(notebookId: number): Task[] {
  const rows = getDb().prepare<[number], TaskRow>(`
    SELECT id, notebook_id, title, details, assignee, status, progress, sort_order, start_date, due_date, notes,
           created_at, in_progress_at, done_at
    FROM tasks
    WHERE notebook_id = ?
  `).all(notebookId);

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    inProgressAt: row.in_progress_at,
    doneAt: row.done_at,
    title: row.title,
    details: row.details,
    assignee: row.assignee,
    tags: [],
    status: normalizeStatus(row.status),
    progress: row.progress,
    sortOrder: row.sort_order,
    startDate: row.start_date,
    dueDate: row.due_date,
    notes: row.notes,
    subtasks: [],
  }));
}

function normalizeTaskSortOrders(tasks: Task[]): Task[] {
  const grouped = new Map<TaskStatus, Task[]>();

  for (const task of tasks) {
    const status = normalizeStatus(task.status);
    grouped.set(status, [...(grouped.get(status) || []), { ...task, status }]);
  }

  const orderById = new Map(tasks.map((task, index) => [task.id, index]));
  const normalizedById = new Map<number, Task>();

  for (const [status, statusTasks] of grouped.entries()) {
    [...statusTasks]
      .sort((a, b) => {
        const aOrder = Number.isFinite(a.sortOrder) ? a.sortOrder! : Number.MAX_SAFE_INTEGER;
        const bOrder = Number.isFinite(b.sortOrder) ? b.sortOrder! : Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (orderById.get(a.id) || 0) - (orderById.get(b.id) || 0);
      })
      .forEach((task, index) => {
        normalizedById.set(task.id, { ...task, status, sortOrder: index });
      });
  }

  return tasks.map((task) => normalizedById.get(task.id) || task);
}
