import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getNotificationPreferences, upsertNotificationPreferences } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/settings/notifications - Get notification preferences for current user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prefs = getNotificationPreferences(session.user.id);

  return NextResponse.json(prefs || {
    user_id: session.user.id,
    notify_all_runs: false,
    notify_successful_runs: false,
    notify_failed_runs: false,
    notify_scheduled_runs: false,
    notify_manual_runs: false,
    email: session.user.email || '',
  });
}

// PUT /api/settings/notifications - Update notification preferences
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    upsertNotificationPreferences({
      user_id: session.user.id,
      notify_all_runs: body.notify_all_runs ?? false,
      notify_successful_runs: body.notify_successful_runs ?? false,
      notify_failed_runs: body.notify_failed_runs ?? false,
      notify_scheduled_runs: body.notify_scheduled_runs ?? false,
      notify_manual_runs: body.notify_manual_runs ?? false,
      email: body.email || session.user.email || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
