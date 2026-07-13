import Database from 'better-sqlite3';
import { DB_FILE } from './db';

const ALLOWED_TABLES = ['tasks', 'subtasks', 'task_tags', 'task_status_events', 'task_due_date_events'] as const;
const BLOCKED_PATTERNS = [
  /\battach\b/i,
  /\balter\b/i,
  /\banalyze\b/i,
  /\bcreate\b/i,
  /\bdelete\b/i,
  /\bdetach\b/i,
  /\bdrop\b/i,
  /\binsert\b/i,
  /\bpragma\b/i,
  /\breindex\b/i,
  /\breplace\b/i,
  /\bupdate\b/i,
  /\bvacuum\b/i,
  /\bsettings\b/i,
  /\bsqlite_master\b/i,
  /\bsqlite_schema\b/i,
  /\bload_extension\b/i,
  /--/,
  /\/\*/,
  /\*\//,
];

export type SqlPlannerResult = {
  sql: string;
  params: unknown[];
  resultType?: string;
};

export type SafeSqlExecution = {
  sql: string;
  rows: Record<string, unknown>[];
};

export const SAFE_SCHEMA_FOR_PROMPT = `
SQLite schema available to you:

tasks(
  id INTEGER,
  notebook_id INTEGER,
  title TEXT,
  details TEXT,
  assignee TEXT,
  status TEXT,
  progress INTEGER,
  sort_order INTEGER,
  start_date TEXT,
  due_date TEXT,
  notes TEXT,
  created_at TEXT,
  in_progress_at TEXT,
  done_at TEXT,
  updated_at TEXT
)

subtasks(
  id INTEGER,
  task_id INTEGER,
  title TEXT,
  completed INTEGER,
  created_at TEXT,
  updated_at TEXT
)

task_tags(
  task_id INTEGER,
  tag TEXT
)

task_status_events(
  id INTEGER,
  task_id INTEGER,
  from_status TEXT,
  to_status TEXT,
  changed_at TEXT
)

task_due_date_events(
  id INTEGER,
  task_id INTEGER,
  from_due_date TEXT,
  to_due_date TEXT,
  changed_at TEXT
)
`;

export function executeSafePlannerSql(plannerResult: SqlPlannerResult, notebookId: number): SafeSqlExecution {
  const sql = normalizeAndValidateSql(plannerResult.sql);
  const referencesTasks = extractReferencedTables(sql).includes('tasks');
  if (referencesTasks && !/\bnotebook_id\b/i.test(sql)) {
    throw new Error('SQL must filter tasks by notebook_id.');
  }
  const params = normalizeParams(plannerResult.params);
  const finalParams = referencesTasks ? [...params, notebookId] : params;
  const limitedSql = addLimitIfMissing(sql);
  const readOnlyDb = new Database(DB_FILE, { readonly: true, fileMustExist: true });

  try {
    const rows = readOnlyDb.prepare(limitedSql).all(...finalParams) as Record<string, unknown>[];
    return {
      sql: limitedSql,
      rows: rows.slice(0, 100),
    };
  } finally {
    readOnlyDb.close();
  }
}

function normalizeAndValidateSql(value: unknown): string {
  if (typeof value !== 'string') throw new Error('SQL planner did not return SQL text.');

  const sql = value.trim().replace(/;+\s*$/, '');
  if (!sql) throw new Error('SQL planner returned empty SQL.');
  if (sql.length > 4000) throw new Error('SQL planner returned SQL that is too long.');
  if (!/^select\b/i.test(sql)) throw new Error('Only SELECT statements are allowed.');
  if (sql.includes(';')) throw new Error('Multiple SQL statements are not allowed.');

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sql)) throw new Error('SQL contains a blocked keyword or pattern.');
  }

  const referencedTables = extractReferencedTables(sql);
  if (referencedTables.length === 0) throw new Error('SQL must read from at least one whitelisted table.');

  for (const table of referencedTables) {
    if (!ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      throw new Error(`SQL references non-whitelisted table: ${table}`);
    }
  }

  return sql;
}

function extractReferencedTables(sql: string) {
  const tables = new Set<string>();
  const tableRegex = /\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(sql)) !== null) {
    tables.add(match[1].toLowerCase());
  }

  return Array.from(tables);
}

function normalizeParams(value: unknown): (string | number | null)[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 20) throw new Error('Too many SQL parameters.');

  return value.map((item) => {
    if (item === null || typeof item === 'string' || typeof item === 'number') return item;
    if (typeof item === 'boolean') return item ? 1 : 0;
    throw new Error('SQL parameters must be strings, numbers, booleans, or null.');
  });
}

function addLimitIfMissing(sql: string) {
  return /\blimit\b/i.test(sql) ? sql : `${sql} LIMIT 100`;
}
