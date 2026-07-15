import { z } from 'zod';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { Task } from '@/types';
import { getSupabaseBrowserClient } from './client';

async function edgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const response = error.context.clone();
      const payload = (await response.json()) as { error?: unknown };
      if (
        response.status >= 400 &&
        response.status < 500 &&
        typeof payload.error === 'string' &&
        payload.error.trim()
      )
        return payload.error;
    } catch {
      // Keep the user-facing fallback when the response is not JSON.
    }
  }
  return fallback;
}

const extractedTaskSchema = z.object({
  createdAt: z.string().optional(),
  title: z.string().min(1).max(500),
  details: z.string().default(''),
  assignee: z.string().default(''),
  startDate: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  notes: z.string().default(''),
});

const assistantResponseSchema = z.object({
  answer: z.string(),
  tasks: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      assignee: z.string(),
      status: z.enum(['URGENT', 'IN PROGRESS', 'TO DO', 'PENDING', 'CANCELLED', 'DONE']),
      dueDate: z.string().nullable(),
      tags: z.array(z.string()),
    })
  ),
  metrics: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

export async function extractTasksWithAi(text: string): Promise<z.infer<typeof extractedTaskSchema>[]> {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke('extract-task', {
    body: { text },
  });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Không thể phân tích task bằng AI.'));
  const parsed = z.array(extractedTaskSchema).safeParse(data);
  if (!parsed.success) throw new Error('AI returned invalid task data.');
  return parsed.data;
}

export async function askTaskAssistant(
  question: string,
  notebookId: string
): Promise<{
  answer: string;
  tasks: Pick<Task, 'id' | 'title' | 'assignee' | 'status' | 'dueDate' | 'tags'>[];
  metrics: Record<string, string | number | null>;
}> {
  const { data, error } = await getSupabaseBrowserClient().functions.invoke('assistant-query', {
    body: { question, notebookId },
  });
  if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Trợ lý AI không thể trả lời lúc này.'));
  const parsed = assistantResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error('AI assistant returned an invalid response.');
  return parsed.data;
}
