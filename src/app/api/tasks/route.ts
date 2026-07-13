import { NextRequest, NextResponse } from 'next/server';
import { readTasksFromDb, writeTasksToDb } from '@/utils/taskRepository';
import { resolveNotebookId } from '@/utils/notebooks';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const notebookId = resolveNotebookId(req.nextUrl.searchParams.get('notebookId'));
    const tasks = await readTasksFromDb(notebookId);
    return NextResponse.json(tasks);
  } catch (error: unknown) {
    console.error('Failed to read tasks:', error);
    return NextResponse.json({ error: 'Failed to read tasks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Expected an array of tasks' }, { status: 400 });
    }

    const notebookId = resolveNotebookId(req.nextUrl.searchParams.get('notebookId'));
    await writeTasksToDb(data, notebookId);
    const tasks = await readTasksFromDb(notebookId);
    return NextResponse.json({ success: true, tasks });
  } catch (error: unknown) {
    console.error('Failed to write tasks:', error);
    return NextResponse.json({ error: 'Failed to write tasks' }, { status: 500 });
  }
}
