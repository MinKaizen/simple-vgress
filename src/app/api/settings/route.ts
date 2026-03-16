import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllSettings, setSetting } from '@/lib/db';
import { updateScheduledRun, updateCleanupSchedule } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';

// GET /api/settings - Get all settings
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = getAllSettings();
  return NextResponse.json(settings);
}

// PUT /api/settings - Update settings
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Update each setting
    if (body.unpromoted_run_retention_days !== undefined) {
      setSetting('unpromoted_run_retention_days', String(body.unpromoted_run_retention_days));
    }
    if (body.baseline_retention_count !== undefined) {
      setSetting('baseline_retention_count', String(body.baseline_retention_count));
    }
    if (body.auto_clean_schedule !== undefined) {
      setSetting('auto_clean_schedule', body.auto_clean_schedule);
      updateCleanupSchedule(body.auto_clean_schedule);
    }
    if (body.scheduled_run_cron !== undefined || body.scheduled_run_enabled !== undefined) {
      const currentSettings = getAllSettings();
      const enabled = body.scheduled_run_enabled ?? currentSettings.scheduled_run_enabled;
      const cron = body.scheduled_run_cron ?? currentSettings.scheduled_run_cron;
      updateScheduledRun(enabled, cron);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
