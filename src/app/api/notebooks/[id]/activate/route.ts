import { NextRequest, NextResponse } from 'next/server';
import { activateNotebook, listNotebooks } from '@/utils/notebooks';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const activeNotebook = activateNotebook(Number(id));
    return NextResponse.json({ activeNotebook, notebooks: listNotebooks() });
  } catch (error: unknown) {
    console.error('Failed to activate notebook:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to activate notebook' }, { status: 400 });
  }
}
