import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';
import type { Subtask, Task, TaskStatus } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.csv');
const TASK_STATUSES: TaskStatus[] = ['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE'];

type CsvTaskRow = {
  id?: string;
  createdAt?: string;
  inProgressAt?: string;
  doneAt?: string;
  title?: string;
  details?: string;
  assignee?: string;
  tags?: string;
  status?: string;
  progress?: string;
  sortOrder?: string;
  startDate?: string;
  dueDate?: string;
  notes?: string;
  subtasks?: string;
};

export async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

export async function readTasks(): Promise<Task[]> {
  await ensureDataDir();
  try {
    const csvData = await fs.readFile(TASKS_FILE, 'utf-8');
    const parsed = Papa.parse<CsvTaskRow>(csvData, {
      header: true,
      skipEmptyLines: true,
    });
    
    // Map CSV rows to Task object
    return parsed.data.map((row) => ({
      id: Number(row.id),
      createdAt: row.createdAt || '',
      inProgressAt: row.inProgressAt || null,
      doneAt: row.doneAt || null,
      title: row.title || '',
      details: row.details || '',
      assignee: row.assignee || '',
      tags: row.tags ? row.tags.split('|').filter(Boolean) : [],
      status: normalizeStatus(row.status),
      progress: Number.isFinite(Number(row.progress)) ? Number(row.progress) : 0,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : undefined,
      startDate: row.startDate || null,
      dueDate: row.dueDate || null,
      notes: row.notes || '',
      subtasks: parseSubtasks(row.subtasks),
    }));
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return []; // File doesn't exist yet
    }
    throw err;
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function normalizeStatus(value: unknown): TaskStatus {
  return typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus)
    ? value as TaskStatus
    : 'TO DO';
}

function parseSubtasks(value: unknown): Subtask[] {
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: unknown) => {
        const candidate = item && typeof item === 'object' ? item as Partial<Subtask> : {};
        return {
          id: Number(candidate.id),
          title: typeof candidate.title === 'string' ? candidate.title : '',
          completed: Boolean(candidate.completed),
        };
      })
      .filter((item) => Number.isFinite(item.id) && item.title.trim() !== '');
  } catch {
    return [];
  }
}

export async function writeTasks(tasks: Task[]): Promise<void> {
  await ensureDataDir();
  
  // Format for CSV
  const csvFormat = tasks.map(t => ({
    id: t.id,
    createdAt: t.createdAt,
    inProgressAt: t.inProgressAt || '',
    doneAt: t.doneAt || '',
    title: t.title,
    details: t.details,
    assignee: t.assignee,
    tags: t.tags.join('|'), // Pipe separated to avoid CSV conflicts
    status: t.status,
    progress: t.progress || 0,
    sortOrder: t.sortOrder ?? '',
    startDate: t.startDate || '',
    dueDate: t.dueDate || '',
    notes: t.notes,
    subtasks: JSON.stringify(t.subtasks || []),
  }));

  const csvString = Papa.unparse(csvFormat);
  await fs.writeFile(TASKS_FILE, csvString, 'utf-8');
}
