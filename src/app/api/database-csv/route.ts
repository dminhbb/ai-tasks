import { NextRequest, NextResponse } from 'next/server';
import { exportDatabaseCsv, importDatabaseCsv } from '@/utils/databaseCsv';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const csv = await exportDatabaseCsv();

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="task-manager-database.csv"',
      },
    });
  } catch (error: unknown) {
    console.error('Failed to export database CSV:', error);
    return NextResponse.json({ error: 'Failed to export database CSV' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const csv = await req.text();
    const result = await importDatabaseCsv(csv);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Failed to import database CSV:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import database CSV' },
      { status: 400 }
    );
  }
}

