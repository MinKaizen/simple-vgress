import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllBaselines, getCurrentBaseline } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/baselines - List all baselines
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baselines = getAllBaselines();
  const current = getCurrentBaseline();

  return NextResponse.json({
    baselines,
    currentId: current?.id || null,
  });
}
