import { addDays, differenceInMilliseconds, endOfDay, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import type { AssistantIntent, Task, TaskStatus } from '@/types';
import { getDb } from './db';

export type AssistantIntentRequest = {
  intent: AssistantIntent;
  tag?: string;
  days?: number;
  status?: TaskStatus;
  query?: string;
  period?: 'week' | 'month' | 'all';
};

export type AssistantTaskResult = Pick<Task, 'id' | 'title' | 'assignee' | 'status' | 'dueDate' | 'tags'> & {
  createdAt: string;
  inProgressAt: string | null;
  doneAt: string | null;
};

export type AssistantQueryResult = {
  intent: AssistantIntent;
  title: string;
  tasks: AssistantTaskResult[];
  metrics: Record<string, string | number | null>;
  note?: string;
};

const ACTIVE_STATUSES: TaskStatus[] = ['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING'];
const TASK_STATUSES: TaskStatus[] = ['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE'];

type DoneEventRow = {
  task_id: number;
  done_at: string;
};

export function executeAssistantQuery(tasks: Task[], request: AssistantIntentRequest): AssistantQueryResult {
  const normalizedRequest = normalizeIntentRequest(request);

  switch (normalizedRequest.intent) {
    case 'TASKS_BY_TAG':
      return tasksByTag(tasks, normalizedRequest.tag);
    case 'DUE_WITHIN_DAYS':
      return dueWithinDays(tasks, normalizedRequest.days ?? 3);
    case 'STATUS_TASKS':
      return tasksByStatus(tasks, normalizedRequest.status || 'IN PROGRESS');
    case 'AVERAGE_COMPLETION_TIME':
      return averageCompletionTime(tasks);
    case 'COMPLETED_IN_PERIOD':
      return completedInPeriod(tasks, normalizedRequest.period || 'month');
    case 'UNFINISHED_BY_TAG':
      return unfinishedByTag(tasks);
    case 'OVERDUE_TASKS':
      return overdueTasks(tasks);
    case 'SEARCH_TASKS':
      return searchTasks(tasks, normalizedRequest.query || '');
    default:
      return {
        intent: 'UNKNOWN',
        title: 'Unsupported question',
        tasks: [],
        metrics: { count: 0 },
        note: 'Question could not be mapped to a supported task query.',
      };
  }
}

export function fallbackIntentFromQuestion(question: string, availableTags: string[]): AssistantIntentRequest {
  const q = question.toLocaleLowerCase();
  const matchedTag = availableTags.find((tag) => q.includes(tag.toLocaleLowerCase()));
  const daysMatch = q.match(/(\d+)\s*(ngày|day|days)/i);

  if (q.includes('trung bình') || q.includes('average')) {
    return { intent: 'AVERAGE_COMPLETION_TIME' };
  }

  if (q.includes('quá hạn') || q.includes('overdue')) {
    return { intent: 'OVERDUE_TASKS' };
  }

  if (q.includes('tới hạn') || q.includes('đến hạn') || q.includes('due')) {
    return { intent: 'DUE_WITHIN_DAYS', days: daysMatch ? Number(daysMatch[1]) : 3 };
  }

  const status = TASK_STATUSES.find((item) => q.includes(item.toLocaleLowerCase()));
  if (status) {
    return { intent: 'STATUS_TASKS', status };
  }

  if (matchedTag) {
    return { intent: 'TASKS_BY_TAG', tag: matchedTag };
  }

  if (q.includes('tag') && (q.includes('chưa xong') || q.includes('chưa hoàn thành'))) {
    return { intent: 'UNFINISHED_BY_TAG' };
  }

  return { intent: 'UNKNOWN', query: question };
}

export function compactTasksForPrompt(tasks: AssistantTaskResult[]) {
  return tasks.slice(0, 12).map((task) => ({
    id: task.id,
    title: task.title,
    assignee: task.assignee,
    status: task.status,
    dueDate: task.dueDate,
    tags: task.tags,
  }));
}

export function deterministicAnswer(result: AssistantQueryResult): string {
  if (result.intent === 'AVERAGE_COMPLETION_TIME') {
    const count = Number(result.metrics.completedTaskCount || 0);
    if (count === 0) return 'Chưa có đủ dữ liệu timestamp để tính thời gian hoàn thành trung bình.';
    return `Thời gian hoàn thành trung bình là ${result.metrics.averageCreatedToDoneHours} giờ tính từ lúc tạo đến DONE, dựa trên ${count} task có đủ dữ liệu.`;
  }

  if (result.intent === 'UNFINISHED_BY_TAG') {
    return result.note || 'Đã tổng hợp số task chưa hoàn thành theo tag.';
  }

  const count = Number(result.metrics.count || 0);
  if (count === 0) return 'Không tìm thấy task phù hợp với câu hỏi.';

  const titles = result.tasks.slice(0, 5).map((task) => `- ${task.title}`).join('\n');
  return `Tìm thấy ${count} task phù hợp:\n${titles}`;
}

function normalizeIntentRequest(request: AssistantIntentRequest): AssistantIntentRequest {
  return {
    ...request,
    days: clampDays(request.days),
    status: normalizeStatus(request.status),
  };
}

function clampDays(value: number | undefined) {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(365, Math.trunc(value || 0)));
}

function normalizeStatus(value: unknown): TaskStatus | undefined {
  return typeof value === 'string' && TASK_STATUSES.includes(value as TaskStatus)
    ? value as TaskStatus
    : undefined;
}

function tasksByTag(tasks: Task[], tag: string | undefined): AssistantQueryResult {
  const normalizedTag = (tag || '').toLocaleLowerCase();
  const matches = normalizedTag
    ? tasks.filter((task) => task.tags.some((item) => item.toLocaleLowerCase() === normalizedTag))
    : [];

  return {
    intent: 'TASKS_BY_TAG',
    title: `Tasks tagged ${tag || ''}`,
    tasks: summarizeTasks(matches),
    metrics: { count: matches.length, tag: tag || null },
  };
}

function dueWithinDays(tasks: Task[], days: number): AssistantQueryResult {
  const todayStart = startOfDay(new Date());
  const dueEnd = endOfDay(addDays(todayStart, days));
  const matches = tasks.filter((task) => {
    const dueDate = parseDate(task.dueDate);
    return Boolean(
      dueDate &&
      ACTIVE_STATUSES.includes(task.status) &&
      !isBefore(dueDate, todayStart) &&
      !isAfter(dueDate, dueEnd)
    );
  });

  return {
    intent: 'DUE_WITHIN_DAYS',
    title: `Tasks due within ${days} days`,
    tasks: summarizeTasks(sortByDueDate(matches)),
    metrics: {
      count: matches.length,
      days,
      from: format(todayStart, 'yyyy-MM-dd'),
      to: format(dueEnd, 'yyyy-MM-dd'),
    },
  };
}

function tasksByStatus(tasks: Task[], status: TaskStatus): AssistantQueryResult {
  const matches = tasks.filter((task) => task.status === status);

  return {
    intent: 'STATUS_TASKS',
    title: `Tasks with status ${status}`,
    tasks: summarizeTasks(sortByDueDate(matches)),
    metrics: { count: matches.length, status },
  };
}

function averageCompletionTime(tasks: Task[]): AssistantQueryResult {
  const latestDoneEvents = getLatestDoneEvents();
  const completed = tasks
    .map((task) => {
      const doneAt = parseDate(task.doneAt || latestDoneEvents.get(task.id));
      const createdAt = parseDate(task.createdAt);
      const inProgressAt = parseDate(task.inProgressAt);
      if (!doneAt || !createdAt) return null;

      return {
        task,
        createdToDoneMs: differenceInMilliseconds(doneAt, createdAt),
        inProgressToDoneMs: inProgressAt ? differenceInMilliseconds(doneAt, inProgressAt) : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> =>
      Boolean(item && item.createdToDoneMs >= 0 && (item.inProgressToDoneMs === null || item.inProgressToDoneMs >= 0))
    );

  const createdToDoneAverage = average(completed.map((item) => item.createdToDoneMs));
  const inProgressDurations = completed
    .map((item) => item.inProgressToDoneMs)
    .filter((value): value is number => typeof value === 'number');
  const inProgressToDoneAverage = average(inProgressDurations);

  return {
    intent: 'AVERAGE_COMPLETION_TIME',
    title: 'Average completion time',
    tasks: summarizeTasks(completed.map((item) => item.task)),
    metrics: {
      completedTaskCount: completed.length,
      inProgressDurationTaskCount: inProgressDurations.length,
      averageCreatedToDoneHours: msToHours(createdToDoneAverage),
      averageInProgressToDoneHours: msToHours(inProgressToDoneAverage),
    },
  };
}

function completedInPeriod(tasks: Task[], period: 'week' | 'month' | 'all'): AssistantQueryResult {
  const now = new Date();
  const start = period === 'week'
    ? addDays(startOfDay(now), -7)
    : period === 'month'
      ? addDays(startOfDay(now), -30)
      : null;
  const doneEvents = getLatestDoneEvents();
  const matches = tasks.filter((task) => {
    const doneAt = parseDate(task.doneAt || doneEvents.get(task.id));
    if (!doneAt) return false;
    return start ? !isBefore(doneAt, start) : true;
  });

  return {
    intent: 'COMPLETED_IN_PERIOD',
    title: `Completed tasks in ${period}`,
    tasks: summarizeTasks(matches),
    metrics: {
      count: matches.length,
      period,
      from: start ? format(start, 'yyyy-MM-dd') : null,
      to: format(now, 'yyyy-MM-dd'),
    },
  };
}

function unfinishedByTag(tasks: Task[]): AssistantQueryResult {
  const counts = new Map<string, number>();
  tasks
    .filter((task) => !['DONE', 'CANCELLED'].includes(task.status))
    .forEach((task) => {
      task.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });

  const grouped = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    intent: 'UNFINISHED_BY_TAG',
    title: 'Unfinished tasks by tag',
    tasks: [],
    metrics: Object.fromEntries(grouped),
    note: grouped.length === 0
      ? 'Không có task chưa hoàn thành theo tag.'
      : grouped.map(([tag, count]) => `${tag}: ${count}`).join('\n'),
  };
}

function overdueTasks(tasks: Task[]): AssistantQueryResult {
  const todayStart = startOfDay(new Date());
  const matches = tasks.filter((task) => {
    const dueDate = parseDate(task.dueDate);
    return Boolean(dueDate && ACTIVE_STATUSES.includes(task.status) && isBefore(dueDate, todayStart));
  });

  return {
    intent: 'OVERDUE_TASKS',
    title: 'Overdue tasks',
    tasks: summarizeTasks(sortByDueDate(matches)),
    metrics: { count: matches.length },
  };
}

function searchTasks(tasks: Task[], query: string): AssistantQueryResult {
  const normalizedQuery = query.toLocaleLowerCase().trim();
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const matches = tokens.length === 0
    ? []
    : tasks.filter((task) => tokens.every((token) =>
        `${task.title} ${stripHtml(task.details)} ${task.assignee} ${task.tags.join(' ')} ${task.notes}`
          .toLocaleLowerCase()
          .includes(token)
      ));

  return {
    intent: 'SEARCH_TASKS',
    title: 'Task search results',
    tasks: summarizeTasks(sortByDueDate(matches)),
    metrics: { count: matches.length, query },
  };
}

function summarizeTasks(tasks: Task[]): AssistantTaskResult[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    assignee: task.assignee,
    status: task.status,
    dueDate: task.dueDate,
    tags: task.tags,
    createdAt: task.createdAt,
    inProgressAt: task.inProgressAt,
    doneAt: task.doneAt,
  }));
}

function sortByDueDate(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const aTime = parseDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = parseDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

function getLatestDoneEvents() {
  const rows = getDb().prepare<[], DoneEventRow>(`
    SELECT task_id, MAX(changed_at) AS done_at
    FROM task_status_events
    WHERE to_status = 'DONE'
    GROUP BY task_id
  `).all();

  return new Map(rows.map((row) => [row.task_id, row.done_at]));
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function msToHours(value: number | null) {
  return value === null ? null : Number((value / 1000 / 60 / 60).toFixed(2));
}

function stripHtml(value: string) {
  return value.replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, ' ');
}
