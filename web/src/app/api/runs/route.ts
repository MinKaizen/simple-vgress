import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllRuns, getRunsCount, addToQueue, getCurrentBaseline } from '@/lib/db';
import { readConfigFile, getOnDemandConfigPath } from '@/lib/storage';
import { processQueue } from '@/lib/queue';
import { v4 as uuid } from 'uuid';
import { parseConfig, urlToSlug } from '@/lib/core/utils';
import * as fs from 'fs';
import * as path from 'path';

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

    // Validate compareTo URLs against the current baseline before queuing
    try {
      const config = parseConfig(configYaml);
      const currentBaseline = getCurrentBaseline();
      const missing: string[] = [];

      for (const [, pageConfig] of Object.entries(config.pages)) {
        if (pageConfig?.compareTo) {
          if (!currentBaseline) {
            missing.push(pageConfig.compareTo);
          } else {
            const slug = urlToSlug(pageConfig.compareTo);
            const baselineDir = currentBaseline.screenshot_path;
            if (!fs.existsSync(baselineDir)) {
              missing.push(pageConfig.compareTo);
            } else {
              const files = fs.readdirSync(baselineDir);
              const exists = files.some((f) => f.startsWith(slug + '.') && f.endsWith('.png'));
              if (!exists) missing.push(pageConfig.compareTo);
            }
          }
        }
      }

      if (missing.length > 0) {
        return NextResponse.json(
          {
            error:
              `The following compareTo URLs were not found in the current baseline: ` +
              missing.join(', ') +
              `. Please check the baseline contains screenshots for these URLs.`,
          },
          { status: 400 }
        );
      }
    } catch (validationError) {
      if (validationError instanceof Error && validationError.message.includes('compareTo')) {
        return NextResponse.json({ error: validationError.message }, { status: 400 });
      }
      // Other parse errors fall through to be caught below
      throw validationError;
    }

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
