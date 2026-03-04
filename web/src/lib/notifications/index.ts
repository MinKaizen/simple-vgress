// Notification module
// Handles sending notifications via Zapier webhook

import { Run, getUsersForNotification, getNotificationPreferences } from '@/lib/db';

interface ZapierPayload {
  event: 'run_completed';
  run_id: string;
  status: string;
  trigger_type: string;
  triggered_by: string | null;
  started_at: string;
  completed_at: string | null;
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
  };
  app_url: string;
  run_url: string;
  recipients: Array<{
    email: string;
    name: string | null;
  }>;
}

/**
 * Send notification for a completed run
 */
export async function sendRunNotification(run: Run): Promise<void> {
  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('[Notifications] No webhook URL configured, skipping notification');
    return;
  }
  
  // Get users who should receive this notification
  const users = getUsersForNotification(run);
  
  if (users.length === 0) {
    console.log('[Notifications] No users to notify for this run');
    return;
  }
  
  // Build recipient list with their notification emails
  const recipients: Array<{ email: string; name: string | null }> = [];
  
  for (const user of users) {
    const prefs = getNotificationPreferences(user.id);
    const email = prefs?.email || user.email;
    recipients.push({ email, name: user.name });
  }
  
  // Parse summary
  let summary = { total: 0, passed: 0, failed: 0, errors: 0 };
  if (run.summary_json) {
    try {
      summary = JSON.parse(run.summary_json);
    } catch {
      // Use default
    }
  }
  
  // Build app URL
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  const payload: ZapierPayload = {
    event: 'run_completed',
    run_id: run.id,
    status: run.status,
    trigger_type: run.trigger_type,
    triggered_by: run.triggered_by_user_email,
    started_at: run.started_at,
    completed_at: run.completed_at,
    summary,
    app_url: appUrl,
    run_url: `${appUrl}/runs/${run.id}`,
    recipients,
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.error(`[Notifications] Webhook failed: ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Notifications] Webhook sent successfully to ${recipients.length} recipients`);
    }
  } catch (error) {
    console.error('[Notifications] Failed to send webhook:', error);
  }
}
