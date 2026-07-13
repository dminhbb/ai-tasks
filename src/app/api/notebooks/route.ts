import { NextRequest, NextResponse } from 'next/server';
import { createNotebook, getActiveNotebook, listNotebooks } from '@/utils/notebooks';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const notebooks = listNotebooks();
    const activeNotebook = getActiveNotebook();
    return NextResponse.json({ notebooks, activeNotebook });
  } catch (error: unknown) {
    console.error('Failed to read notebooks:', error);
    return NextResponse.json({ error: 'Failed to read notebooks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const notebook = createNotebook(typeof data.name === 'string' ? data.name : 'UNTITLED');
    return NextResponse.json({ notebook, notebooks: listNotebooks() });
  } catch (error: unknown) {
    console.error('Failed to create notebook:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create notebook' }, { status: 400 });
  }
}
