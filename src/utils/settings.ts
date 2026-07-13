import fs from 'fs';
import path from 'path';
import type { AssistantConfiguredIntent, AssistantIntent, Settings, TaskStatus } from '@/types';
import { getDb } from './db';
import { resolveNotebookId } from './notebooks';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: '',
  tags: ['Frontend', 'Backend', 'Design', 'Bug', 'Feature'],
  assistantIntents: [
    {
      id: 'tasks-tag-alm',
      label: 'Tag ALM',
      question: 'Các công việc liên quan tới tag ALM là gì?',
      intent: 'TASKS_BY_TAG',
      tag: 'ALM',
      enabled: true,
    },
    {
      id: 'due-3-days',
      label: 'Due in 3 days',
      question: 'Tôi có task nào tới hạn trong 3 ngày?',
      intent: 'DUE_WITHIN_DAYS',
      days: 3,
      enabled: true,
    },
    {
      id: 'avg-completion',
      label: 'Average completion',
      question: 'Thời gian trung bình hoàn thành task là bao lâu?',
      intent: 'AVERAGE_COMPLETION_TIME',
      enabled: true,
    },
  ],
};

export async function readSettings(notebookIdInput?: number): Promise<Settings> {
  const notebookId = resolveNotebookId(notebookIdInput);
  migrateLegacySettingsIfNeeded(notebookId);

  const rows = getDb()
    .prepare<[number], { key: string; value: string }>('SELECT key, value FROM settings WHERE notebook_id IN (0, ?)')
    .all(notebookId);
  const values = new Map(rows.map((row) => [row.key, row.value]));

  const settings = {
    geminiApiKey: values.get('geminiApiKey') || DEFAULT_SETTINGS.geminiApiKey,
    tags: parseTags(values.get('tags')),
    assistantIntents: parseAssistantIntents(values.get('assistantIntents')),
  };

  if (!values.has('assistantIntents') || !values.has('tags')) {
    writeSettingsToDb(settings, notebookId);
  }

  return settings;
}

export async function writeSettings(settings: Settings, notebookIdInput?: number): Promise<void> {
  writeSettingsToDb(settings, resolveNotebookId(notebookIdInput));
}

function migrateLegacySettingsIfNeeded(notebookId: number) {
  const row = getDb()
    .prepare<[number], { count: number }>('SELECT COUNT(*) AS count FROM settings WHERE notebook_id IN (0, ?)')
    .get(notebookId);

  if ((row?.count || 0) > 0) return;

  let settings = DEFAULT_SETTINGS;
  if (fs.existsSync(SETTINGS_FILE)) {
    const parsed = parseSettingsJson(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    settings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      tags: Array.isArray(parsed.tags) ? parsed.tags : DEFAULT_SETTINGS.tags,
    };
  }

  writeSettingsToDb(settings, notebookId);
}

function writeSettingsToDb(settings: Settings, notebookId: number) {
  const nowIso = new Date().toISOString();
  const upsert = getDb().prepare(`
    INSERT INTO settings (notebook_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(notebook_id, key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);

  const transaction = getDb().transaction(() => {
    upsert.run(0, 'geminiApiKey', settings.geminiApiKey || '', nowIso);
    upsert.run(notebookId, 'tags', JSON.stringify(settings.tags || []), nowIso);
    upsert.run(notebookId, 'assistantIntents', JSON.stringify(normalizeAssistantIntents(settings.assistantIntents)), nowIso);
  });

  transaction();
}

function parseSettingsJson(value: string): Partial<Settings> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return {};

    const candidate = parsed as Partial<Settings>;
    return {
      geminiApiKey: typeof candidate.geminiApiKey === 'string' ? candidate.geminiApiKey : undefined,
      tags: Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
      assistantIntents: Array.isArray(candidate.assistantIntents) ? normalizeAssistantIntents(candidate.assistantIntents) : undefined,
    };
  } catch {
    return {};
  }
}

function parseAssistantIntents(value: string | undefined): AssistantConfiguredIntent[] {
  if (!value) return DEFAULT_SETTINGS.assistantIntents;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return DEFAULT_SETTINGS.assistantIntents;
    const normalized = normalizeAssistantIntents(parsed);
    return normalized.length > 0 ? normalized : DEFAULT_SETTINGS.assistantIntents;
  } catch {
    return DEFAULT_SETTINGS.assistantIntents;
  }
}

function normalizeAssistantIntents(value: unknown): AssistantConfiguredIntent[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index): AssistantConfiguredIntent | null => {
      const candidate = item && typeof item === 'object' ? item as Partial<AssistantConfiguredIntent> : {};
      const intent = normalizeIntent(candidate.intent);
      const question = typeof candidate.question === 'string' ? candidate.question.trim().slice(0, 255) : '';
      if (!intent || !question) return null;

      return {
        id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : `assistant-intent-${index + 1}`,
        label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim().slice(0, 80) : question.slice(0, 80),
        question,
        intent,
        enabled: candidate.enabled !== false,
        tag: typeof candidate.tag === 'string' ? candidate.tag.trim() : undefined,
        days: typeof candidate.days === 'number' && Number.isFinite(candidate.days) ? Math.max(0, Math.min(365, Math.trunc(candidate.days))) : undefined,
        status: normalizeStatus(candidate.status),
        query: typeof candidate.query === 'string' ? candidate.query.trim().slice(0, 255) : undefined,
        period: candidate.period === 'week' || candidate.period === 'month' || candidate.period === 'all' ? candidate.period : undefined,
      };
    })
    .filter((item): item is AssistantConfiguredIntent => item !== null);
}

function normalizeIntent(value: unknown): AssistantIntent | undefined {
  const intents: AssistantIntent[] = [
    'TASKS_BY_TAG',
    'DUE_WITHIN_DAYS',
    'STATUS_TASKS',
    'AVERAGE_COMPLETION_TIME',
    'COMPLETED_IN_PERIOD',
    'UNFINISHED_BY_TAG',
    'OVERDUE_TASKS',
    'SEARCH_TASKS',
    'UNKNOWN',
  ];
  return typeof value === 'string' && intents.includes(value as AssistantIntent)
    ? value as AssistantIntent
    : undefined;
}

function normalizeStatus(value: unknown): TaskStatus | undefined {
  const statuses: TaskStatus[] = ['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE'];
  return typeof value === 'string' && statuses.includes(value as TaskStatus)
    ? value as TaskStatus
    : undefined;
}

function parseTags(value: string | undefined): string[] {
  if (!value) return DEFAULT_SETTINGS.tags;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return DEFAULT_SETTINGS.tags;
    return parsed.filter((tag): tag is string => typeof tag === 'string');
  } catch {
    return DEFAULT_SETTINGS.tags;
  }
}
