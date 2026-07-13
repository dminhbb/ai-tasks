import { NextRequest, NextResponse } from 'next/server';
import { deleteNotebook, listNotebooks, renameNotebook } from '@/utils/notebooks';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const data = await req.json();
    const notebook = renameNotebook(Number(id), typeof data.name === 'string' ? data.name : '');
    return NextResponse.json({ notebook, notebooks: listNotebooks() });
  } catch (error: unknown) {
    console.error('Failed to rename notebook:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to rename notebook' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const activeNotebook = deleteNotebook(Number(id));
    return NextResponse.json({ activeNotebook, notebooks: listNotebooks() });
  } catch (error: unknown) {
    console.error('Failed to delete notebook:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete notebook' }, { status: 400 });
  }
}
