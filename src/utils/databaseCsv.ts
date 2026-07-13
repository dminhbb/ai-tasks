import Papa from 'papaparse';
import type { Settings, Task } from '@/types';
import { getDb } from './db';
import { getActiveNotebook } from './notebooks';
import { readSettings } from './settings';
import { readTasksFromDb } from './taskRepository';

const TABLES = ['notebooks', 'tasks', 'subtasks', 'task_tags', 'settings', 'task_status_events', 'task_due_date_events'] as const;
type TableName = typeof TABLES[number];

const CSV_COLUMNS = [
  '__table',
  'id',
  'notebook_id',
  'task_id',
  'key',
  'value',
  'name',
  'title',
  'details',
  'assignee',
  'status',
  'progress',
  'sort_order',
  'from_status',
  'to_status',
  'from_due_date',
  'to_due_date',
  'tag',
  'start_date',
  'due_date',
  'notes',
  'created_at',
  'in_progress_at',
  'done_at',
  'updated_at',
  'last_accessed_at',
  'completed',
  'changed_at',
] as const;

type CsvColumn = typeof CSV_COLUMNS[number];
type ExportRow = Record<CsvColumn, string | number | null>;
type ParsedRow = Partial<Record<CsvColumn, string>>;

type NotebookDbRow = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
};

type TaskDbRow = {
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
  updated_at: string;
};

type SubtaskDbRow = {
  id: number;
  task_id: number;
  title: string;
  completed: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type TaskTagDbRow = {
  task_id: number;
  tag: string;
};

type SettingDbRow = {
  notebook_id: number;
  key: string;
  value: string;
  updated_at: string;
};

type StatusEventDbRow = {
  id: number;
  notebook_id: number;
  task_id: number;
  from_status: string | null;
  to_status: string;
  changed_at: string;
};

type DueDateEventDbRow = {
  id: number;
  notebook_id: number;
  task_id: number;
  from_due_date: string | null;
  to_due_date: string | null;
  changed_at: string;
};

export async function exportDatabaseCsv(): Promise<string> {
  const db = getDb();
  const rows: ExportRow[] = [];

  db.prepare<[], NotebookDbRow>('SELECT * FROM notebooks ORDER BY id ASC').all().forEach((row) => {
    rows.push(rowFor('notebooks', {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_accessed_at: row.last_accessed_at,
    }));
  });

  db.prepare<[], TaskDbRow>('SELECT * FROM tasks ORDER BY notebook_id ASC, id ASC').all().forEach((row) => {
    rows.push(rowFor('tasks', {
      id: row.id,
      notebook_id: row.notebook_id,
      title: row.title,
      details: row.details,
      assignee: row.assignee,
      status: row.status,
      progress: row.progress,
      sort_order: row.sort_order,
      start_date: row.start_date,
      due_date: row.due_date,
      notes: row.notes,
      created_at: row.created_at,
      in_progress_at: row.in_progress_at,
      done_at: row.done_at,
      updated_at: row.updated_at,
    }));
  });

  db.prepare<[], SubtaskDbRow>('SELECT * FROM subtasks ORDER BY task_id ASC, sort_order ASC, id ASC').all().forEach((row) => {
    rows.push(rowFor('subtasks', {
      id: row.id,
      task_id: row.task_id,
      title: row.title,
      completed: row.completed,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  });

  db.prepare<[], TaskTagDbRow>('SELECT * FROM task_tags ORDER BY task_id ASC, tag ASC').all().forEach((row) => {
    rows.push(rowFor('task_tags', {
      task_id: row.task_id,
      tag: row.tag,
    }));
  });

  db.prepare<[], SettingDbRow>('SELECT * FROM settings ORDER BY notebook_id ASC, key ASC').all().forEach((row) => {
    rows.push(rowFor('settings', {
      notebook_id: row.notebook_id,
      key: row.key,
      value: row.value,
      updated_at: row.updated_at,
    }));
  });

  db.prepare<[], StatusEventDbRow>('SELECT * FROM task_status_events ORDER BY notebook_id ASC, id ASC').all().forEach((row) => {
    rows.push(rowFor('task_status_events', {
      id: row.id,
      notebook_id: row.notebook_id,
      task_id: row.task_id,
      from_status: row.from_status,
      to_status: row.to_status,
      changed_at: row.changed_at,
    }));
  });

  db.prepare<[], DueDateEventDbRow>('SELECT * FROM task_due_date_events ORDER BY notebook_id ASC, id ASC').all().forEach((row) => {
    rows.push(rowFor('task_due_date_events', {
      id: row.id,
      notebook_id: row.notebook_id,
      task_id: row.task_id,
      from_due_date: row.from_due_date,
      to_due_date: row.to_due_date,
      changed_at: row.changed_at,
    }));
  });

  return Papa.unparse(rows, { columns: [...CSV_COLUMNS] });
}

export async function importDatabaseCsv(csv: string): Promise<{ tasks: Task[]; settings: Settings }> {
  const parsed = Papa.parse<ParsedRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message || 'Invalid CSV file');
  }

  const rowsByTable = groupRowsByTable(parsed.data);
  replaceDatabase(rowsByTable);
  const notebookId = getActiveNotebook().id;

  return {
    tasks: await readTasksFromDb(notebookId),
    settings: await readSettings(notebookId),
  };
}

function rowFor(tableName: TableName, values: Partial<ExportRow>): ExportRow {
  const row = Object.fromEntries(CSV_COLUMNS.map((column) => [column, ''])) as ExportRow;
  row.__table = tableName;

  for (const [key, value] of Object.entries(values)) {
    row[key as CsvColumn] = value;
  }

  return row;
}

function groupRowsByTable(rows: ParsedRow[]) {
  const grouped = new Map<TableName, ParsedRow[]>();
  for (const table of TABLES) grouped.set(table, []);

  for (const row of rows) {
    const table = row.__table || 'tasks';
    if (!isTableName(table)) {
      throw new Error(`Unknown table in CSV: ${table || '(empty)'}`);
    }

    grouped.get(table)!.push(row);
  }

  return grouped;
}

function replaceDatabase(rowsByTable: Map<TableName, ParsedRow[]>) {
  const db = getDb();

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM task_due_date_events').run();
    db.prepare('DELETE FROM task_status_events').run();
    db.prepare('DELETE FROM task_tags').run();
    db.prepare('DELETE FROM subtasks').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM settings').run();
    db.prepare('DELETE FROM notebooks').run();

    const fallbackNotebookId = insertNotebooks(rowsByTable.get('notebooks') || []);

    const insertTask = db.prepare(`
      INSERT INTO tasks (
        id, notebook_id, title, details, assignee, status, sort_order, start_date, due_date, notes,
        progress, created_at, in_progress_at, done_at, updated_at
      ) VALUES (
        @id, @notebook_id, @title, @details, @assignee, @status, @sort_order, @start_date, @due_date, @notes,
        @progress, @created_at, @in_progress_at, @done_at, @updated_at
      )
    `);
    const insertSubtask = db.prepare(`
      INSERT INTO subtasks (id, task_id, title, completed, sort_order, created_at, updated_at)
      VALUES (@id, @task_id, @title, @completed, @sort_order, @created_at, @updated_at)
    `);
    const insertTag = db.prepare('INSERT INTO task_tags (task_id, tag) VALUES (?, ?)');
    const insertSetting = db.prepare(`
      INSERT INTO settings (notebook_id, key, value, updated_at)
      VALUES (@notebook_id, @key, @value, @updated_at)
    `);
    const insertStatusEvent = db.prepare(`
      INSERT INTO task_status_events (id, notebook_id, task_id, from_status, to_status, changed_at)
      VALUES (@id, @notebook_id, @task_id, @from_status, @to_status, @changed_at)
    `);
    const insertDueDateEvent = db.prepare(`
      INSERT INTO task_due_date_events (id, notebook_id, task_id, from_due_date, to_due_date, changed_at)
      VALUES (@id, @notebook_id, @task_id, @from_due_date, @to_due_date, @changed_at)
    `);

    for (const row of rowsByTable.get('tasks') || []) {
      insertTask.run({
        id: requiredInteger(row.id, 'tasks.id'),
        notebook_id: optionalInteger(row.notebook_id, fallbackNotebookId),
        title: requiredText(row.title, 'tasks.title'),
        details: row.details || '',
        assignee: row.assignee || '',
        status: requiredText(row.status, 'tasks.status'),
        progress: optionalInteger(row.progress, 0),
        sort_order: optionalInteger(row.sort_order, 0),
        start_date: emptyToNull(row.start_date),
        due_date: emptyToNull(row.due_date),
        notes: row.notes || '',
        created_at: requiredText(row.created_at, 'tasks.created_at'),
        in_progress_at: emptyToNull(row.in_progress_at),
        done_at: emptyToNull(row.done_at),
        updated_at: requiredText(row.updated_at, 'tasks.updated_at'),
      });
    }

    for (const row of rowsByTable.get('settings') || []) {
      insertSetting.run({
        notebook_id: optionalInteger(row.notebook_id, row.key === 'geminiApiKey' ? 0 : fallbackNotebookId),
        key: requiredText(row.key, 'settings.key'),
        value: row.value || '',
        updated_at: requiredText(row.updated_at, 'settings.updated_at'),
      });
    }

    for (const row of rowsByTable.get('subtasks') || []) {
      insertSubtask.run({
        id: requiredInteger(row.id, 'subtasks.id'),
        task_id: requiredInteger(row.task_id, 'subtasks.task_id'),
        title: requiredText(row.title, 'subtasks.title'),
        completed: booleanInteger(row.completed),
        sort_order: optionalInteger(row.sort_order, 0),
        created_at: requiredText(row.created_at, 'subtasks.created_at'),
        updated_at: requiredText(row.updated_at, 'subtasks.updated_at'),
      });
    }

    for (const row of rowsByTable.get('task_tags') || []) {
      insertTag.run(
        requiredInteger(row.task_id, 'task_tags.task_id'),
        requiredText(row.tag, 'task_tags.tag')
      );
    }

    for (const row of rowsByTable.get('task_status_events') || []) {
      insertStatusEvent.run({
        id: requiredInteger(row.id, 'task_status_events.id'),
        notebook_id: optionalInteger(row.notebook_id, fallbackNotebookId),
        task_id: requiredInteger(row.task_id, 'task_status_events.task_id'),
        from_status: emptyToNull(row.from_status),
        to_status: requiredText(row.to_status, 'task_status_events.to_status'),
        changed_at: requiredText(row.changed_at, 'task_status_events.changed_at'),
      });
    }

    for (const row of rowsByTable.get('task_due_date_events') || []) {
      insertDueDateEvent.run({
        id: requiredInteger(row.id, 'task_due_date_events.id'),
        notebook_id: optionalInteger(row.notebook_id, fallbackNotebookId),
        task_id: requiredInteger(row.task_id, 'task_due_date_events.task_id'),
        from_due_date: emptyToNull(row.from_due_date),
        to_due_date: emptyToNull(row.to_due_date),
        changed_at: requiredText(row.changed_at, 'task_due_date_events.changed_at'),
      });
    }
  });

  transaction();
}

function insertNotebooks(rows: ParsedRow[]) {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const insertNotebook = db.prepare(`
    INSERT INTO notebooks (id, name, created_at, updated_at, last_accessed_at)
    VALUES (@id, @name, @created_at, @updated_at, @last_accessed_at)
  `);

  if (rows.length === 0) {
    insertNotebook.run({
      id: 1,
      name: 'MAIN',
      created_at: nowIso,
      updated_at: nowIso,
      last_accessed_at: nowIso,
    });
    return 1;
  }

  let fallbackNotebookId = 1;
  for (const row of rows) {
    const id = requiredInteger(row.id, 'notebooks.id');
    fallbackNotebookId = id;
    insertNotebook.run({
      id,
      name: requiredText(row.name, 'notebooks.name'),
      created_at: requiredText(row.created_at, 'notebooks.created_at'),
      updated_at: requiredText(row.updated_at, 'notebooks.updated_at'),
      last_accessed_at: requiredText(row.last_accessed_at, 'notebooks.last_accessed_at'),
    });
  }

  return fallbackNotebookId;
}

function isTableName(value: unknown): value is TableName {
  return typeof value === 'string' && TABLES.includes(value as TableName);
}

function emptyToNull(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function requiredText(value: string | undefined, fieldName: string) {
  if (!value) throw new Error(`Missing required value: ${fieldName}`);
  return value;
}

function requiredInteger(value: string | undefined, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Invalid integer value: ${fieldName}`);
  return parsed;
}

function optionalInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function booleanInteger(value: string | undefined) {
  return value === '1' || value?.toLowerCase() === 'true' ? 1 : 0;
}
