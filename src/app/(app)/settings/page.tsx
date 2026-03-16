'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

interface Settings {
  unpromoted_run_retention_days: number;
  baseline_retention_count: number;
  auto_clean_schedule: string;
  scheduled_run_cron: string;
  scheduled_run_enabled: boolean;
}

interface NotificationPrefs {
  notify_all_runs: boolean;
  notify_successful_runs: boolean;
  notify_failed_runs: boolean;
  notify_scheduled_runs: boolean;
  notify_manual_runs: boolean;
  email: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCleaningAuto, setIsCleaningAuto] = useState(false);
  const [isCleaningFull, setIsCleaningFull] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(res => res.json()),
      fetch('/api/settings/notifications').then(res => res.json()),
    ])
      .then(([settingsData, notifData]) => {
        setSettings(settingsData);
        setNotificationPrefs(notifData);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!notificationPrefs) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationPrefs),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Notification preferences saved' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save preferences' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoClean = async () => {
    setIsCleaningAuto(true);
    setMessage(null);

    try {
      const response = await fetch('/api/cleanup/auto', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Auto clean completed: ${data.runsDeleted} failed runs deleted` 
        });
      } else {
        setMessage({ type: 'error', text: 'Auto clean failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Auto clean failed' });
    } finally {
      setIsCleaningAuto(false);
    }
  };

  const handleFullClean = async () => {
    setIsCleaningFull(true);
    setMessage(null);

    try {
      const response = await fetch('/api/cleanup/full', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Full cleanup completed: ${data.runsDeleted} runs, ${data.baselinesDeleted} baselines deleted` 
        });
      } else {
        setMessage({ type: 'error', text: 'Cleanup failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Cleanup failed' });
    } finally {
      setIsCleaningFull(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-[var(--muted-foreground)]">
          Configure schedules, retention policies, and notifications
        </p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          message.type === 'success' 
            ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]'
            : 'bg-[var(--destructive)]/10 text-[var(--destructive)] border border-[var(--destructive)]'
        }`}>
          {message.text}
        </div>
      )}

      {/* Schedule Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Runs</CardTitle>
          <CardDescription>
            Configure automatic visual regression runs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Scheduled Runs</Label>
              <p className="text-sm text-[var(--muted-foreground)]">
                Automatically run tests on a schedule
              </p>
            </div>
            <Switch
              checked={settings?.scheduled_run_enabled ?? false}
              onCheckedChange={(checked) =>
                setSettings((prev) => prev && { ...prev, scheduled_run_enabled: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cron">Schedule (Cron Expression)</Label>
            <Input
              id="cron"
              value={settings?.scheduled_run_cron ?? ''}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, scheduled_run_cron: e.target.value })
              }
              placeholder="0 6 * * *"
              className="font-mono"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Default: 0 6 * * * (6:00 AM daily)
            </p>
          </div>

          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Schedule Settings
          </Button>
        </CardContent>
      </Card>

      {/* Retention Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Retention Policies</CardTitle>
          <CardDescription>
            Configure how long data is kept
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="run-retention">Unpromoted Run Retention (days)</Label>
            <Input
              id="run-retention"
              type="number"
              min={1}
              value={settings?.unpromoted_run_retention_days ?? 7}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, unpromoted_run_retention_days: parseInt(e.target.value, 10) })
              }
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Runs that haven&apos;t been promoted to baseline are deleted after this many days
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseline-retention">Baseline History Count</Label>
            <Input
              id="baseline-retention"
              type="number"
              min={1}
              value={settings?.baseline_retention_count ?? 3}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, baseline_retention_count: parseInt(e.target.value, 10) })
              }
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Number of previous baselines to keep (current baseline is always kept)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cleanup-cron">Cleanup Schedule (Cron)</Label>
            <Input
              id="cleanup-cron"
              value={settings?.auto_clean_schedule ?? ''}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, auto_clean_schedule: e.target.value })
              }
              placeholder="0 3 * * *"
              className="font-mono"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Default: 0 3 * * * (3:00 AM daily)
            </p>
          </div>

          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Retention Settings
          </Button>
        </CardContent>
      </Card>

      {/* Manual Cleanup */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Cleanup</CardTitle>
          <CardDescription>
            Manually trigger cleanup operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <h4 className="font-medium">Auto Clean</h4>
              <p className="text-sm text-[var(--muted-foreground)]">
                Delete failed runs only. Never deletes baselines or successful runs.
              </p>
            </div>
            <Button variant="outline" onClick={handleAutoClean} disabled={isCleaningAuto}>
              {isCleaningAuto ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Auto Clean
            </Button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <h4 className="font-medium">Full Cleanup</h4>
              <p className="text-sm text-[var(--muted-foreground)]">
                Apply retention policies now (deletes old runs and baselines beyond retention limits)
              </p>
            </div>
            <Button variant="destructive" onClick={handleFullClean} disabled={isCleaningFull}>
              {isCleaningFull ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Full Cleanup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose which runs you want to be notified about
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notif-email">Notification Email</Label>
            <Input
              id="notif-email"
              type="email"
              value={notificationPrefs?.email ?? session?.user?.email ?? ''}
              onChange={(e) =>
                setNotificationPrefs((prev) => prev && { ...prev, email: e.target.value })
              }
              placeholder={session?.user?.email ?? 'your@email.com'}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-all"
                checked={notificationPrefs?.notify_all_runs ?? false}
                onCheckedChange={(checked) =>
                  setNotificationPrefs((prev) => prev && { ...prev, notify_all_runs: !!checked })
                }
              />
              <Label htmlFor="notify-all">All runs</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-success"
                checked={notificationPrefs?.notify_successful_runs ?? false}
                onCheckedChange={(checked) =>
                  setNotificationPrefs((prev) => prev && { ...prev, notify_successful_runs: !!checked })
                }
              />
              <Label htmlFor="notify-success">Successful runs only</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-failed"
                checked={notificationPrefs?.notify_failed_runs ?? false}
                onCheckedChange={(checked) =>
                  setNotificationPrefs((prev) => prev && { ...prev, notify_failed_runs: !!checked })
                }
              />
              <Label htmlFor="notify-failed">Failed runs only</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-scheduled"
                checked={notificationPrefs?.notify_scheduled_runs ?? false}
                onCheckedChange={(checked) =>
                  setNotificationPrefs((prev) => prev && { ...prev, notify_scheduled_runs: !!checked })
                }
              />
              <Label htmlFor="notify-scheduled">Scheduled runs only</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-manual"
                checked={notificationPrefs?.notify_manual_runs ?? false}
                onCheckedChange={(checked) =>
                  setNotificationPrefs((prev) => prev && { ...prev, notify_manual_runs: !!checked })
                }
              />
              <Label htmlFor="notify-manual">Manual runs only</Label>
            </div>
          </div>

          <Button onClick={handleSaveNotifications} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Notification Preferences
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
