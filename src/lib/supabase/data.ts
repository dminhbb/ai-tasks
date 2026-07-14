import { z } from 'zod';
import type {
  Notebook,
  NotebookPermissions,
  Settings,
  Subtask,
  Task,
  TaskStatus,
  UserProfile,
} from '@/types';
import { getSupabaseBrowserClient } from './client';

const DEFAULT_TAGS = ['Frontend', 'Backend', 'Design', 'Bug', 'Feature'];
const DEFAULT_SETTINGS: Settings = { tags: DEFAULT_TAGS, assistantIntents: [] };

const notebookRowSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  last_accessed_at: z.string(),
});

const membershipRowSchema = z.object({
  notebook_id: z.string().uuid(),
  role: z.enum(['admin', 'user']),
  permissions: z.record(z.string(), z.unknown()),
});

const subtaskRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  completed: z.boolean(),
  is_today: z.boolean(),
  completed_at: z.string().nullable(),
  sort_order: z.number(),
});

const taskRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  details: z.string(),
  assignee: z.string(),
  status: z.enum(['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE']),
  progress: z.number(),
  sort_order: z.number(),
  start_date: z.string().nullable(),
  due_date: z.string().nullable(),
  notes: z.string(),
  created_at: z.string(),
  in_progress_at: z.string().nullable(),
  done_at: z.string().nullable(),
  subtasks: z.array(subtaskRowSchema).default([]),
  task_tags: z.array(z.object({ tag: z.string() })).default([]),
  task_due_date_events: z.array(z.object({ id: z.number() })).default([]),
});

const assistantIntentSchema = z.object({
  id: z.string(),
  label: z.string(),
  question: z.string(),
  intent: z.enum([
    'TASKS_BY_TAG',
    'DUE_WITHIN_DAYS',
    'STATUS_TASKS',
    'AVERAGE_COMPLETION_TIME',
    'COMPLETED_IN_PERIOD',
    'UNFINISHED_BY_TAG',
    'OVERDUE_TASKS',
    'SEARCH_TASKS',
    'UNKNOWN',
  ]),
  enabled: z.boolean(),
  tag: z.string().optional(),
  days: z.number().optional(),
  status: z.enum(['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE']).optional(),
  query: z.string().optional(),
  period: z.enum(['week', 'month', 'all']).optional(),
});

function safePermission(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function permissionsForProfile(
  profile: UserProfile,
  membership: z.infer<typeof membershipRowSchema> | undefined
): NotebookPermissions {
  if (profile.role === 'superadmin') {
    return { manageTasks: true, manageNotebook: true, manageSettings: true };
  }
  if (!membership) {
    return { manageTasks: false, manageNotebook: false, manageSettings: false };
  }

  return {
    manageTasks: safePermission(membership.permissions.manage_tasks, true),
    manageNotebook:
      membership.role === 'admin' && safePermission(membership.permissions.manage_notebook, false),
    manageSettings:
      membership.role === 'admin' && safePermission(membership.permissions.manage_settings, false),
  };
}

export async function listNotebooks(profile: UserProfile): Promise<Notebook[]> {
  const supabase = getSupabaseBrowserClient();
  const [{ data: notebookData, error: notebookError }, { data: membershipData, error: membershipError }] =
    await Promise.all([
      supabase
        .from('notebooks')
        .select('id, owner_id, name, created_at, updated_at, last_accessed_at')
        .order('last_accessed_at', { ascending: false }),
      supabase
        .from('notebook_members')
        .select('notebook_id, role, permissions')
        .eq('user_id', profile.id),
    ]);

  if (notebookError || membershipError) throw new Error('Không thể tải danh sách notebook.');

  const memberships = new Map(
    z.array(membershipRowSchema)
      .parse(membershipData ?? [])
      .map((membership) => [membership.notebook_id, membership])
  );

  return z.array(notebookRowSchema).parse(notebookData ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
    permissions: permissionsForProfile(profile, memberships.get(row.id)),
  }));
}

export async function createNotebook(name: string, profile: UserProfile): Promise<Notebook> {
  const normalizedName = name.trim().replace(/\s+/g, ' ').slice(0, 80) || 'UNTITLED';
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('notebooks')
    .insert({ name: normalizedName, owner_id: profile.id })
    .select('id, owner_id, name, created_at, updated_at, last_accessed_at')
    .single();
  if (error) throw new Error('Bạn không có quyền tạo notebook.');

  const row = notebookRowSchema.parse(data);
  const { error: settingsError } = await supabase
    .from('notebook_settings')
    .insert({ notebook_id: row.id, tags: DEFAULT_TAGS, assistant_intents: [] });
  if (settingsError) {
    await supabase.from('notebooks').delete().eq('id', row.id);
    throw new Error('Không thể khởi tạo cài đặt notebook.');
  }

  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
    permissions: { manageTasks: true, manageNotebook: true, manageSettings: true },
  };
}

export async function renameNotebook(notebookId: string, name: string): Promise<void> {
  const normalizedName = name.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!normalizedName) throw new Error('Tên notebook là bắt buộc.');
  const { error } = await getSupabaseBrowserClient()
    .from('notebooks')
    .update({ name: normalizedName })
    .eq('id', notebookId);
  if (error) throw new Error('Bạn không có quyền đổi tên notebook.');
}

export async function deleteNotebook(notebookId: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient().from('notebooks').delete().eq('id', notebookId);
  if (error) throw new Error('Bạn không có quyền xóa notebook.');
}

export async function touchNotebook(notebookId: string, canManageNotebook: boolean): Promise<void> {
  if (!canManageNotebook) return;
  await getSupabaseBrowserClient()
    .from('notebooks')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', notebookId);
}

export async function readTasks(notebookId: string): Promise<Task[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('tasks')
    .select(`
      id, title, details, assignee, status, progress, sort_order,
      start_date, due_date, notes, created_at, in_progress_at, done_at,
      subtasks(id, title, completed, is_today, completed_at, sort_order),
      task_tags(tag),
      task_due_date_events(id)
    `)
    .eq('notebook_id', notebookId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error('Không thể tải danh sách task.');

  return z.array(taskRowSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    inProgressAt: row.in_progress_at,
    doneAt: row.done_at,
    title: row.title,
    details: row.details,
    assignee: row.assignee,
    tags: row.task_tags.map(({ tag }) => tag),
    status: row.status as TaskStatus,
    progress: row.progress,
    sortOrder: row.sort_order,
    startDate: row.start_date,
    dueDate: row.due_date,
    dueDateChangeCount: row.task_due_date_events.length,
    notes: row.notes,
    subtasks: [...row.subtasks]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((subtask): Subtask => ({
        id: subtask.id,
        title: subtask.title,
        completed: subtask.completed,
        isToday: subtask.is_today,
        completedAt: subtask.completed_at,
        sortOrder: subtask.sort_order,
      })),
  }));
}

function comparableTask(task: Task): string {
  return JSON.stringify({
    ...task,
    dueDateChangeCount: undefined,
    subtasks: task.subtasks.map((subtask) => ({ ...subtask, sortOrder: subtask.sortOrder ?? 0 })),
    sortOrder: task.sortOrder ?? 0,
  });
}

export async function saveTasks(
  notebookId: string,
  previousTasks: Task[],
  nextTasks: Task[]
): Promise<Task[]> {
  const supabase = getSupabaseBrowserClient();
  const previousById = new Map(previousTasks.map((task) => [task.id, task]));
  const nextIds = new Set(nextTasks.map((task) => task.id));
  const changedTasks = nextTasks.filter((task) => {
    const previousTask = previousById.get(task.id);
    return !previousTask || comparableTask(previousTask) !== comparableTask(task);
  });

  for (const task of changedTasks) {
    const { error } = await supabase.rpc('save_task_bundle', {
      requested_notebook_id: notebookId,
      task_data: {
        id: task.id,
        createdAt: task.createdAt,
        inProgressAt: task.inProgressAt,
        doneAt: task.doneAt,
        title: task.title.trim() || 'Untitled',
        details: task.details,
        assignee: task.assignee,
        status: task.status,
        progress: task.progress,
        sortOrder: task.sortOrder ?? 0,
        startDate: task.startDate,
        dueDate: task.dueDate,
        notes: task.notes,
      },
      subtask_data: task.subtasks.map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        completed: subtask.completed,
        isToday: subtask.isToday,
        sortOrder: subtask.sortOrder ?? 0,
      })),
      tag_data: task.tags,
    });
    if (error) throw new Error('Không thể lưu task. Vui lòng tải lại dữ liệu và thử lại.');
  }

  const deletedIds = previousTasks.filter((task) => !nextIds.has(task.id)).map((task) => task.id);
  if (deletedIds.length > 0) {
    const { error } = await supabase.from('tasks').delete().eq('notebook_id', notebookId).in('id', deletedIds);
    if (error) throw new Error('Không thể xóa task.');
  }

  return readTasks(notebookId);
}

export async function readSettings(notebookId: string): Promise<Settings> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('notebook_settings')
    .select('tags, assistant_intents')
    .eq('notebook_id', notebookId)
    .maybeSingle();
  if (error) throw new Error('Không thể tải cài đặt notebook.');
  if (!data) return DEFAULT_SETTINGS;

  return {
    tags: z.array(z.string()).parse(data.tags),
    assistantIntents: z.array(assistantIntentSchema).parse(data.assistant_intents),
  };
}

export async function writeSettings(notebookId: string, settings: Settings): Promise<void> {
  const { error } = await getSupabaseBrowserClient()
    .from('notebook_settings')
    .upsert({
      notebook_id: notebookId,
      tags: settings.tags,
      assistant_intents: settings.assistantIntents,
    });
  if (error) throw new Error('Bạn không có quyền thay đổi cài đặt notebook.');
}
