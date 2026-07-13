import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = path.join(process.cwd(), 'data');
export const DB_FILE = path.join(DATA_DIR, 'task-manager.db');

let db: Database.Database | null = null;

export function ensureDataDirSync() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDirSync();
    db = new Database(DB_FILE);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    initializeSchema(db);
  }

  return db;
}

function initializeSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_accessed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      notebook_id INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      assignee TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      start_date TEXT,
      due_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      in_progress_at TEXT,
      done_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (task_id, tag),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      notebook_id INTEGER NOT NULL DEFAULT 0,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (notebook_id, key)
    );

    CREATE TABLE IF NOT EXISTS task_status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id INTEGER NOT NULL DEFAULT 1,
      task_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_due_date_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notebook_id INTEGER NOT NULL DEFAULT 1,
      task_id INTEGER NOT NULL,
      from_due_date TEXT,
      to_due_date TEXT,
      changed_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_status_events_task_id ON task_status_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_status_events_changed_at ON task_status_events(changed_at);
    CREATE INDEX IF NOT EXISTS idx_due_date_events_task_id ON task_due_date_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_due_date_events_changed_at ON task_due_date_events(changed_at);
  `);

  const defaultNotebookId = ensureDefaultNotebook(database);

  const taskColumns = database.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  if (!taskColumns.some((column) => column.name === 'notebook_id')) {
    database.prepare(`ALTER TABLE tasks ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${defaultNotebookId}`).run();
  }
  if (!taskColumns.some((column) => column.name === 'sort_order')) {
    database.prepare('ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!taskColumns.some((column) => column.name === 'progress')) {
    database.prepare('ALTER TABLE tasks ADD COLUMN progress INTEGER NOT NULL DEFAULT 0').run();
  }

  const subtaskColumns = database.prepare("PRAGMA table_info(subtasks)").all() as { name: string }[];
  if (!subtaskColumns.some((column) => column.name === 'sort_order')) {
    database.prepare('ALTER TABLE subtasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0').run();
  }

  migrateSettingsTable(database, defaultNotebookId);

  const statusEventColumns = database.prepare("PRAGMA table_info(task_status_events)").all() as { name: string }[];
  if (!statusEventColumns.some((column) => column.name === 'notebook_id')) {
    database.prepare(`ALTER TABLE task_status_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${defaultNotebookId}`).run();
  }

  const dueDateEventColumns = database.prepare("PRAGMA table_info(task_due_date_events)").all() as { name: string }[];
  if (!dueDateEventColumns.some((column) => column.name === 'notebook_id')) {
    database.prepare(`ALTER TABLE task_due_date_events ADD COLUMN notebook_id INTEGER NOT NULL DEFAULT ${defaultNotebookId}`).run();
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_notebook_id ON tasks(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_sort_order ON tasks(status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_subtasks_task_sort_order ON subtasks(task_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_settings_notebook_key ON settings(notebook_id, key);
    CREATE INDEX IF NOT EXISTS idx_status_events_notebook_task_id ON task_status_events(notebook_id, task_id);
    CREATE INDEX IF NOT EXISTS idx_due_date_events_notebook_task_id ON task_due_date_events(notebook_id, task_id);
  `);
}

function ensureDefaultNotebook(database: Database.Database) {
  const existing = database.prepare<[], { id: number }>('SELECT id FROM notebooks ORDER BY last_accessed_at DESC, id ASC LIMIT 1').get();
  if (existing) return existing.id;

  const nowIso = new Date().toISOString();
  const result = database.prepare(`
    INSERT INTO notebooks (name, created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?)
  `).run('MAIN', nowIso, nowIso, nowIso);

  return Number(result.lastInsertRowid);
}

function migrateSettingsTable(database: Database.Database, defaultNotebookId: number) {
  const columns = database.prepare("PRAGMA table_info(settings)").all() as { name: string; pk: number }[];
  const hasNotebookId = columns.some((column) => column.name === 'notebook_id');
  const keyColumn = columns.find((column) => column.name === 'key');
  const notebookColumn = columns.find((column) => column.name === 'notebook_id');
  const hasCompositePrimaryKey = Boolean(keyColumn?.pk && notebookColumn?.pk);
  if (hasNotebookId && hasCompositePrimaryKey) return;

  database.exec(`
    CREATE TABLE IF NOT EXISTS settings_next (
      notebook_id INTEGER NOT NULL DEFAULT 0,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (notebook_id, key)
    );
  `);

  const rows = database.prepare<[], { notebook_id?: number; key: string; value: string; updated_at: string }>(
    hasNotebookId
      ? 'SELECT notebook_id, key, value, updated_at FROM settings'
      : 'SELECT key, value, updated_at FROM settings'
  ).all();
  const insert = database.prepare(`
    INSERT OR REPLACE INTO settings_next (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  for (const row of rows) {
    const notebookId = row.key === 'geminiApiKey' ? 0 : row.notebook_id || defaultNotebookId;
    insert.run(notebookId, row.key, row.value, row.updated_at);
  }

  database.exec(`
    DROP TABLE settings;
    ALTER TABLE settings_next RENAME TO settings;
  `);
}
