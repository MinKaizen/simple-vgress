import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runAutoClean } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// POST /api/cleanup/auto - Run auto cleanup (failed runs only)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = runAutoClean();
    return NextResponse.json({
      success: true,
      runsDeleted: result.runsDeleted,
    });
  } catch (error) {
    console.error('Error running auto cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    );
  }
}
