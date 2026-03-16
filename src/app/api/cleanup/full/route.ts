import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runScheduledCleanup } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// POST /api/cleanup/full - Run full cleanup (based on retention policies)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = runScheduledCleanup();
    return NextResponse.json({
      success: true,
      runsDeleted: result.runsDeleted,
      baselinesDeleted: result.baselinesDeleted,
    });
  } catch (error) {
    console.error('Error running full cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    );
  }
}
