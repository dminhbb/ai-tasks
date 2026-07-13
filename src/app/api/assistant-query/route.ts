import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format } from 'date-fns';
import type { AssistantConfiguredIntent, Task } from '@/types';
import { readSettings } from '@/utils/settings';
import { readTasksFromDb } from '@/utils/taskRepository';
import { resolveNotebookId } from '@/utils/notebooks';
import {
  compactTasksForPrompt,
  deterministicAnswer,
  executeAssistantQuery,
  fallbackIntentFromQuestion,
  type AssistantIntentRequest,
} from '@/utils/assistantQueries';
import { executeSafePlannerSql, SAFE_SCHEMA_FOR_PROMPT, type SqlPlannerResult } from '@/utils/assistantSqlPlanner';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { question, notebookId: notebookIdInput } = await req.json();
    if (typeof question !== 'string' || question.trim() === '') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const notebookId = resolveNotebookId(notebookIdInput);
    const settings = await readSettings(notebookId);
    if (!settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured in Settings' }, { status: 400 });
    }

    const tasks = await readTasksFromDb(notebookId);
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const configuredIntent = findConfiguredIntent(question, settings.assistantIntents || []);
    const intent = configuredIntent
      ? configuredIntentToRequest(configuredIntent)
      : await classifyQuestion(model, question, settings.tags);

    if (intent.intent === 'UNKNOWN') {
      const plannerResult = await planSqlQuestion(model, question);
      const execution = executeSafePlannerSql(plannerResult, notebookId);
      const answer = await summarizeSqlRows(model, question, execution.sql, execution.rows);
      const relatedTasks = getRelatedTasksFromRows(tasks, execution.rows);

      return NextResponse.json({
        answer,
        intent: 'SQL_PLANNER',
        tasks: relatedTasks.slice(0, 25),
        metrics: {
          rowCount: execution.rows.length,
          mode: 'sql_planner',
        },
      });
    }

    const result = executeAssistantQuery(tasks, intent);
    const answer = await summarizeResult(model, question, result);

    return NextResponse.json({
      answer,
      intent: result.intent,
      tasks: result.tasks.slice(0, 25),
      metrics: result.metrics,
      note: result.note,
    });
  } catch (error: unknown) {
    console.error('Assistant query error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to answer question' },
      { status: 500 }
    );
  }
}

async function classifyQuestion(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  question: string,
  tags: string[]
): Promise<AssistantIntentRequest> {
  const prompt = `
You classify Vietnamese or English questions about a personal task manager.
Return only JSON, no markdown.

Supported intents:
- TASKS_BY_TAG: questions about tasks with a tag. Params: tag.
- DUE_WITHIN_DAYS: tasks due within N days. Params: days.
- STATUS_TASKS: tasks by status. Params: status.
- AVERAGE_COMPLETION_TIME: average time to complete tasks.
- COMPLETED_IN_PERIOD: completed tasks in recent week/month/all. Params: period.
- UNFINISHED_BY_TAG: count unfinished tasks grouped by tag.
- OVERDUE_TASKS: overdue unfinished tasks.
- SEARCH_TASKS: broad keyword search. Params: query.
- UNKNOWN: unsupported.

Valid statuses: URGENT, IN PROGRESS, TO DO, PENDING, CANCELLED, DONE.
Available tags: ${JSON.stringify(tags)}
Current date: ${format(new Date(), 'yyyy-MM-dd')}

Question: ${JSON.stringify(question)}

JSON shape:
{
  "intent": "TASKS_BY_TAG",
  "tag": "ALM",
  "days": 3,
  "status": "IN PROGRESS",
  "query": "policy",
  "period": "month"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = (await result.response).text();
    const parsed = parseJsonObject(rawText);
    const intent = parsed.intent;
    if (typeof intent !== 'string') throw new Error('Missing intent');

    return {
      intent: intent as AssistantIntentRequest['intent'],
      tag: typeof parsed.tag === 'string' ? parsed.tag : undefined,
      days: typeof parsed.days === 'number' ? parsed.days : Number(parsed.days) || undefined,
      status: typeof parsed.status === 'string' ? parsed.status as AssistantIntentRequest['status'] : undefined,
      query: typeof parsed.query === 'string' ? parsed.query : undefined,
      period: parsed.period === 'week' || parsed.period === 'month' || parsed.period === 'all' ? parsed.period : undefined,
    };
  } catch {
    return fallbackIntentFromQuestion(question, tags);
  }
}

async function summarizeResult(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  question: string,
  result: ReturnType<typeof executeAssistantQuery>
) {
  const prompt = `
You are answering inside a personal task manager. Answer in Vietnamese, concise and factual.
Use only the provided query result. Do not invent missing tasks or metrics.
If there are tasks, mention the most relevant task titles and due dates when useful.

Question: ${JSON.stringify(question)}
Intent: ${result.intent}
Metrics: ${JSON.stringify(result.metrics)}
Note: ${JSON.stringify(result.note || '')}
Tasks: ${JSON.stringify(compactTasksForPrompt(result.tasks))}
`;

  try {
    const response = await (await model.generateContent(prompt)).response;
    return response.text().trim() || deterministicAnswer(result);
  } catch {
    return deterministicAnswer(result);
  }
}

async function planSqlQuestion(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  question: string
): Promise<SqlPlannerResult> {
  const prompt = `
You are a SQL planner for a personal task manager.
Return only JSON, no markdown.

Generate exactly one SQLite SELECT statement to answer the user question.
The server will reject unsafe SQL, so follow these rules:
- SELECT only. Do not use WITH.
- Do not use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, REPLACE, PRAGMA, ATTACH, DETACH, VACUUM.
- Do not query settings or any table not listed in the schema.
- Use only these whitelisted tables: tasks, subtasks, task_tags, task_status_events, task_due_date_events.
- If querying tasks directly or through joins, include a task notebook filter such as t.notebook_id = ? and put that notebook placeholder last in params. The server appends the active notebook id.
- Use ? placeholders for user values and return params as an array.
- Include LIMIT 100 for row-list queries.
- Prefer explicit columns instead of SELECT *.

${SAFE_SCHEMA_FOR_PROMPT}

Current date: ${format(new Date(), 'yyyy-MM-dd')}
Question: ${JSON.stringify(question)}

JSON shape:
{
  "sql": "SELECT t.id, t.title, t.assignee, t.status, t.due_date FROM tasks t JOIN task_tags tt ON tt.task_id = t.id WHERE tt.tag = ? AND t.notebook_id = ? LIMIT 100",
  "params": ["ALM"],
  "resultType": "task_list"
}
`;

  const result = await model.generateContent(prompt);
  const rawText = (await result.response).text();
  const parsed = parseJsonObject(rawText);

  return {
    sql: typeof parsed.sql === 'string' ? parsed.sql : '',
    params: Array.isArray(parsed.params) ? parsed.params : [],
    resultType: typeof parsed.resultType === 'string' ? parsed.resultType : undefined,
  };
}

async function summarizeSqlRows(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  question: string,
  sql: string,
  rows: Record<string, unknown>[]
) {
  const prompt = `
You are answering inside a personal task manager. Answer in Vietnamese, concise and factual.
Use only the provided SQL result rows. Do not invent missing rows or metrics.
Do not mention implementation details unless useful.

Question: ${JSON.stringify(question)}
Validated SQL: ${JSON.stringify(sql)}
Rows: ${JSON.stringify(rows.slice(0, 40))}
Row count: ${rows.length}
`;

  try {
    const response = await (await model.generateContent(prompt)).response;
    return response.text().trim() || deterministicSqlAnswer(rows);
  } catch {
    return deterministicSqlAnswer(rows);
  }
}

function deterministicSqlAnswer(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 'Không tìm thấy dữ liệu phù hợp với câu hỏi.';
  const preview = rows
    .slice(0, 5)
    .map((row) => {
      const title = typeof row.title === 'string' ? row.title : JSON.stringify(row);
      return `- ${title}`;
    })
    .join('\n');
  return `Tìm thấy ${rows.length} dòng dữ liệu phù hợp:\n${preview}`;
}

function findConfiguredIntent(question: string, intents: AssistantConfiguredIntent[]) {
  const normalizedQuestion = question.trim().toLocaleLowerCase();
  return intents.find((intent) =>
    intent.enabled &&
    intent.question.trim().toLocaleLowerCase() === normalizedQuestion
  );
}

function configuredIntentToRequest(intent: AssistantConfiguredIntent): AssistantIntentRequest {
  return {
    intent: intent.intent,
    tag: intent.tag,
    days: intent.days,
    status: intent.status,
    query: intent.query || intent.question,
    period: intent.period,
  };
}

function getRelatedTasksFromRows(tasks: Task[], rows: Record<string, unknown>[]) {
  const ids = new Set<number>();
  for (const row of rows) {
    const id = numberFromUnknown(row.id) ?? numberFromUnknown(row.task_id);
    if (typeof id === 'number') ids.add(id);
  }
  return tasks.filter((task) => ids.has(task.id)).map((task) => ({
    id: task.id,
    title: task.title,
    assignee: task.assignee,
    status: task.status,
    dueDate: task.dueDate,
    tags: task.tags,
  }));
}

function numberFromUnknown(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed: unknown = JSON.parse(cleaned);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}
