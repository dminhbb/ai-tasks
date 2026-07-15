import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import {
  createSupabaseAdminClient,
  findAuthUserByEmail,
  requiredEnvironment,
} from './supabase-admin-client.mjs';

const ownerEmail = (
  process.env.MIGRATION_OWNER_EMAIL?.trim() ||
  process.env.SEED_SUPERADMIN_EMAIL?.trim() ||
  'minhd.mbb@gmail.com'
).toLocaleLowerCase();
const databasePath = process.env.SQLITE_DATABASE_PATH?.trim() || 'data/task-manager.db';
requiredEnvironment('SUPABASE_SECRET_KEY');

const supabase = createSupabaseAdminClient();
const owner = await findAuthUserByEmail(supabase, ownerEmail);
if (!owner)
  throw new Error(`Auth user does not exist: ${ownerEmail}. Run npm run supabase:seed-admin first.`);

const db = new Database(databasePath, { readonly: true, fileMustExist: true });

function all(sql) {
  return db.prepare(sql).all();
}

function parseJsonArray(value, fallback = []) {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function insertRows(table, rows) {
  const chunkSize = 200;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error } = await supabase.from(table).insert(rows.slice(index, index + chunkSize));
    if (error) throw new Error(`Unable to migrate ${table}: ${error.message}`);
  }
}

try {
  const sourceNotebooks = all(
    'select id, name, created_at, updated_at, last_accessed_at from notebooks order by id'
  );
  const sourceTasks = all(`
    select id, notebook_id, title, details, assignee, status, progress, sort_order,
           start_date, due_date, notes, created_at, in_progress_at, done_at, updated_at
    from tasks order by notebook_id, id
  `);
  const sourceSubtasks = all(
    'select id, task_id, title, completed, sort_order, created_at, updated_at from subtasks order by task_id, sort_order, id'
  );
  const sourceTags = all('select task_id, tag from task_tags order by task_id, tag');
  const sourceSettings = all('select notebook_id, key, value from settings where notebook_id > 0');
  const sourceStatusEvents = all(`
    select notebook_id, task_id, from_status, to_status, changed_at
    from task_status_events order by id
  `);
  const sourceDueDateEvents = all(`
    select notebook_id, task_id, from_due_date, to_due_date, changed_at
    from task_due_date_events order by id
  `);

  const notebookIds = new Map(sourceNotebooks.map((row) => [row.id, randomUUID()]));
  const taskIds = new Map(sourceTasks.map((row) => [row.id, randomUUID()]));
  const subtaskIds = new Map(sourceSubtasks.map((row) => [row.id, randomUUID()]));

  const notebookRows = sourceNotebooks.map((row) => ({
    id: notebookIds.get(row.id),
    owner_id: owner.id,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_accessed_at: row.last_accessed_at,
  }));
  await insertRows('notebooks', notebookRows);

  const settingsByNotebook = new Map();
  for (const row of sourceSettings) {
    const current = settingsByNotebook.get(row.notebook_id) ?? {
      tags: ['Frontend', 'Backend', 'Design', 'Bug', 'Feature'],
      assistant_intents: [],
    };
    if (row.key === 'tags') current.tags = parseJsonArray(row.value, current.tags);
    if (row.key === 'assistantIntents') current.assistant_intents = parseJsonArray(row.value, []);
    settingsByNotebook.set(row.notebook_id, current);
  }
  await insertRows(
    'notebook_settings',
    sourceNotebooks.map((row) => ({
      notebook_id: notebookIds.get(row.id),
      ...(settingsByNotebook.get(row.id) ?? {
        tags: ['Frontend', 'Backend', 'Design', 'Bug', 'Feature'],
        assistant_intents: [],
      }),
    }))
  );

  await insertRows(
    'tasks',
    sourceTasks.map((row) => ({
      id: taskIds.get(row.id),
      notebook_id: notebookIds.get(row.notebook_id),
      title: row.title,
      details: row.details,
      assignee: row.assignee,
      status: row.status,
      progress: row.progress,
      sort_order: row.sort_order,
      start_date: row.start_date || null,
      due_date: row.due_date || null,
      notes: row.notes,
      created_at: row.created_at,
      in_progress_at: row.in_progress_at || null,
      done_at: row.done_at || null,
      updated_at: row.updated_at,
    }))
  );

  await insertRows(
    'subtasks',
    sourceSubtasks.map((row) => ({
      id: subtaskIds.get(row.id),
      task_id: taskIds.get(row.task_id),
      title: row.title,
      completed: Boolean(row.completed),
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
  );
  await insertRows(
    'task_tags',
    sourceTags.map((row) => ({ task_id: taskIds.get(row.task_id), tag: row.tag }))
  );

  const migratedNotebookIds = [...notebookIds.values()];
  if (migratedNotebookIds.length > 0) {
    const { error: clearStatusError } = await supabase
      .from('task_status_events')
      .delete()
      .in('notebook_id', migratedNotebookIds);
    if (clearStatusError)
      throw new Error(`Unable to reset generated status events: ${clearStatusError.message}`);
  }
  await insertRows(
    'task_status_events',
    sourceStatusEvents.map((row) => ({
      notebook_id: notebookIds.get(row.notebook_id),
      task_id: taskIds.get(row.task_id),
      from_status: row.from_status || null,
      to_status: row.to_status,
      changed_at: row.changed_at,
    }))
  );
  await insertRows(
    'task_due_date_events',
    sourceDueDateEvents.map((row) => ({
      notebook_id: notebookIds.get(row.notebook_id),
      task_id: taskIds.get(row.task_id),
      from_due_date: row.from_due_date || null,
      to_due_date: row.to_due_date || null,
      changed_at: row.changed_at,
    }))
  );

  console.log(
    `Migrated ${sourceNotebooks.length} notebooks, ${sourceTasks.length} tasks, ` +
      `${sourceSubtasks.length} subtasks and ${sourceTags.length} tags for ${ownerEmail}.`
  );
} finally {
  db.close();
}
