import { NextRequest, NextResponse } from 'next/server';
import { initScheduler } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';

// This route is called to initialize the scheduler
// It can be called on server start or manually

let initialized = false;

// GET /api/scheduler/init - Initialize the scheduler
export async function GET(request: NextRequest) {
  if (initialized) {
    return NextResponse.json({ status: 'already initialized' });
  }

  try {
    initScheduler();
    initialized = true;
    return NextResponse.json({ status: 'initialized' });
  } catch (error) {
    console.error('Failed to initialize scheduler:', error);
    return NextResponse.json(
      { error: 'Failed to initialize scheduler' },
      { status: 500 }
    );
  }
}
