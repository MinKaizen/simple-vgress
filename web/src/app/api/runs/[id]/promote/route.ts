import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRunById } from '@/lib/db';
import { promoteRunToBaseline } from '@/lib/core/runner';

export const dynamic = 'force-dynamic';

// POST /api/runs/[id]/promote - Promote a run to baseline
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const run = getRunById(id);

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const reason = body.reason || (run.status === 'success' ? 'All tests passed' : 'Manual promotion');

    promoteRunToBaseline(
      id,
      session.user.id,
      session.user.email || null,
      reason
    );

    return NextResponse.json({
      success: true,
      message: 'Run promoted to baseline',
    });
  } catch (error) {
    console.error('Error promoting run:', error);
    return NextResponse.json(
      { error: 'Failed to promote run' },
      { status: 500 }
    );
  }
}
