import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBaselineById, restoreBaseline } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/baselines/[id]/restore - Restore a baseline as current
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const baseline = getBaselineById(id);

  if (!baseline) {
    return NextResponse.json({ error: 'Baseline not found' }, { status: 404 });
  }

  try {
    restoreBaseline(id);
    return NextResponse.json({
      success: true,
      message: 'Baseline restored',
    });
  } catch (error) {
    console.error('Error restoring baseline:', error);
    return NextResponse.json(
      { error: 'Failed to restore baseline' },
      { status: 500 }
    );
  }
}
