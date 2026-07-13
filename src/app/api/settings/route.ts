import { NextRequest, NextResponse } from 'next/server';
import { readSettings, writeSettings } from '@/utils/settings';
import { resolveNotebookId } from '@/utils/notebooks';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const notebookId = resolveNotebookId(req.nextUrl.searchParams.get('notebookId'));
    const settings = await readSettings(notebookId);
    return NextResponse.json(settings);
  } catch (error: unknown) {
    console.error('Failed to read settings:', error);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const notebookId = resolveNotebookId(req.nextUrl.searchParams.get('notebookId'));
    await writeSettings(data, notebookId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to write settings:', error);
    return NextResponse.json({ error: 'Failed to write settings' }, { status: 500 });
  }
}
