import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRunById } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/runs/[id] - Get a specific run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const run = getRunById(id);

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  return NextResponse.json(run);
}
