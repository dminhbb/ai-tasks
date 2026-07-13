import type { Notebook } from '@/types';
import { getDb } from './db';

type NotebookRow = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
};

function rowToNotebook(row: NotebookRow): Notebook {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

export function listNotebooks(): Notebook[] {
  return getDb()
    .prepare<[], NotebookRow>('SELECT * FROM notebooks ORDER BY last_accessed_at DESC, name ASC')
    .all()
    .map(rowToNotebook);
}

export function getNotebook(id: number): Notebook | null {
  const row = getDb().prepare<[number], NotebookRow>('SELECT * FROM notebooks WHERE id = ?').get(id);
  return row ? rowToNotebook(row) : null;
}

export function getActiveNotebook(): Notebook {
  const row = getDb()
    .prepare<[], NotebookRow>('SELECT * FROM notebooks ORDER BY last_accessed_at DESC, id ASC LIMIT 1')
    .get();
  if (row) return rowToNotebook(row);
  return createNotebook('MAIN');
}

export function resolveNotebookId(value: unknown): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0 && getNotebook(parsed)) return parsed;
  return getActiveNotebook().id;
}

export function activateNotebook(id: number): Notebook {
  const notebook = getNotebook(id);
  if (!notebook) throw new Error('Notebook not found');

  const nowIso = new Date().toISOString();
  getDb().prepare('UPDATE notebooks SET last_accessed_at = ?, updated_at = ? WHERE id = ?').run(nowIso, nowIso, id);
  return getNotebook(id)!;
}

export function createNotebook(name: string): Notebook {
  const nowIso = new Date().toISOString();
  const normalizedName = normalizeNotebookName(name) || 'UNTITLED';
  const result = getDb().prepare(`
    INSERT INTO notebooks (name, created_at, updated_at, last_accessed_at)
    VALUES (?, ?, ?, ?)
  `).run(normalizedName, nowIso, nowIso, nowIso);

  const id = Number(result.lastInsertRowid);
  seedNotebookSettings(id, nowIso);
  return getNotebook(id)!;
}

export function renameNotebook(id: number, name: string): Notebook {
  const notebook = getNotebook(id);
  if (!notebook) throw new Error('Notebook not found');

  const normalizedName = normalizeNotebookName(name);
  if (!normalizedName) throw new Error('Notebook name is required');

  const nowIso = new Date().toISOString();
  getDb().prepare('UPDATE notebooks SET name = ?, updated_at = ? WHERE id = ?').run(normalizedName, nowIso, id);
  return getNotebook(id)!;
}

export function deleteNotebook(id: number): Notebook {
  const notebook = getNotebook(id);
  if (!notebook) throw new Error('Notebook not found');

  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM task_due_date_events WHERE notebook_id = ?').run(id);
    db.prepare('DELETE FROM task_status_events WHERE notebook_id = ?').run(id);
    db.prepare('DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)').run(id);
    db.prepare('DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE notebook_id = ?)').run(id);
    db.prepare('DELETE FROM tasks WHERE notebook_id = ?').run(id);
    db.prepare('DELETE FROM settings WHERE notebook_id = ?').run(id);
    db.prepare('DELETE FROM notebooks WHERE id = ?').run(id);
  });
  transaction();

  const fallback = getActiveNotebook();
  return fallback || createNotebook('MAIN');
}

function seedNotebookSettings(notebookId: number, nowIso: string) {
  const existingTags = getDb()
    .prepare<[number, string], { value: string }>('SELECT value FROM settings WHERE notebook_id = ? AND key = ?')
    .get(notebookId, 'tags');
  if (existingTags) return;

  const insert = getDb().prepare(`
    INSERT OR IGNORE INTO settings (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  insert.run(notebookId, 'tags', JSON.stringify(['Frontend', 'Backend', 'Design', 'Bug', 'Feature']), nowIso);
  insert.run(notebookId, 'assistantIntents', JSON.stringify([]), nowIso);
}

function normalizeNotebookName(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}
