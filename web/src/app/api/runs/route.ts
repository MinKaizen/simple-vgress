import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllRuns, getRunsCount, addToQueue } from '@/lib/db';
import { readConfigFile, getOnDemandConfigPath } from '@/lib/storage';
import { processQueue } from '@/lib/queue';
import { v4 as uuid } from 'uuid';

export const dynamic = 'force-dynamic';

// GET /api/runs - List all runs
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const runs = getAllRuns(limit, offset);
  const total = getRunsCount();

  return NextResponse.json({
    runs,
    total,
    limit,
    offset,
  });
}

// POST /api/runs - Create a new run
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const configYaml = body.config || readConfigFile(getOnDemandConfigPath());

    const queueId = `queue_${uuid()}`;
    
    addToQueue({
      id: queueId,
      requested_by_user_id: session.user.id,
      trigger_type: 'manual',
      config_yaml: configYaml,
    });

    // Start queue processing
    setImmediate(() => processQueue());

    return NextResponse.json({
      success: true,
      queueId,
      message: 'Run queued successfully',
    });
  } catch (error) {
    console.error('Error creating run:', error);
    return NextResponse.json(
      { error: 'Failed to create run' },
      { status: 500 }
    );
  }
}
