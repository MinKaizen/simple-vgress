// Scheduler module
// Handles cron-based scheduled runs and cleanup

import * as cron from 'node-cron';
import { getAllSettings, setSetting, addToQueue, getQueuedCount } from '@/lib/db';
import { readConfigFile, getScheduledConfigPath, runScheduledCleanup } from '@/lib/storage';
import { v4 as uuid } from 'uuid';

// Store active cron jobs
let scheduledRunJob: cron.ScheduledTask | null = null;
let cleanupJob: cron.ScheduledTask | null = null;

// Track initialization
let isInitialized = false;

/**
 * Initialize the scheduler
 * Should be called once when the server starts
 */
export function initScheduler(): void {
  if (isInitialized) {
    console.log('[Scheduler] Already initialized, skipping');
    return;
  }
  
  console.log('[Scheduler] Initializing...');
  
  const settings = getAllSettings();
  
  // Set up scheduled run job
  if (settings.scheduled_run_enabled) {
    scheduleRun(settings.scheduled_run_cron);
  }
  
  // Set up cleanup job
  scheduleCleanup(settings.auto_clean_schedule);
  
  isInitialized = true;
  console.log('[Scheduler] Initialization complete');
}

/**
 * Schedule the visual regression run
 */
export function scheduleRun(cronExpression: string): void {
  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    console.error(`[Scheduler] Invalid cron expression for run: ${cronExpression}`);
    return;
  }
  
  // Cancel existing job if any
  if (scheduledRunJob) {
    scheduledRunJob.stop();
    scheduledRunJob = null;
  }
  
  console.log(`[Scheduler] Scheduling run with cron: ${cronExpression}`);
  
  scheduledRunJob = cron.schedule(cronExpression, async () => {
    console.log('[Scheduler] Triggering scheduled run...');
    
    try {
      // Read scheduled config
      const configPath = getScheduledConfigPath();
      const configYaml = readConfigFile(configPath);
      
      // Add to queue
      addToQueue({
        id: `queue_${uuid()}`,
        requested_by_user_id: null,
        trigger_type: 'scheduled',
        config_yaml: configYaml,
      });
      
      console.log('[Scheduler] Scheduled run added to queue');
    } catch (error) {
      console.error('[Scheduler] Failed to trigger scheduled run:', error);
    }
  });
}

/**
 * Schedule the cleanup job
 */
export function scheduleCleanup(cronExpression: string): void {
  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    console.error(`[Scheduler] Invalid cron expression for cleanup: ${cronExpression}`);
    return;
  }
  
  // Cancel existing job if any
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
  }
  
  console.log(`[Scheduler] Scheduling cleanup with cron: ${cronExpression}`);
  
  cleanupJob = cron.schedule(cronExpression, async () => {
    console.log('[Scheduler] Running scheduled cleanup...');
    
    try {
      const result = runScheduledCleanup();
      console.log(`[Scheduler] Cleanup complete: ${result.runsDeleted} runs deleted, ${result.baselinesDeleted} baselines deleted`);
    } catch (error) {
      console.error('[Scheduler] Cleanup failed:', error);
    }
  });
}

/**
 * Update scheduled run settings
 */
export function updateScheduledRun(enabled: boolean, cronExpression?: string): void {
  setSetting('scheduled_run_enabled', enabled ? 'true' : 'false');
  
  if (cronExpression) {
    setSetting('scheduled_run_cron', cronExpression);
  }
  
  if (scheduledRunJob) {
    scheduledRunJob.stop();
    scheduledRunJob = null;
  }
  
  if (enabled) {
    const settings = getAllSettings();
    scheduleRun(cronExpression || settings.scheduled_run_cron);
  }
}

/**
 * Update cleanup schedule
 */
export function updateCleanupSchedule(cronExpression: string): void {
  setSetting('auto_clean_schedule', cronExpression);
  scheduleCleanup(cronExpression);
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  scheduledRunEnabled: boolean;
  scheduledRunCron: string;
  scheduledRunNextRun: Date | null;
  cleanupCron: string;
  cleanupNextRun: Date | null;
  queuedCount: number;
} {
  const settings = getAllSettings();
  
  return {
    scheduledRunEnabled: settings.scheduled_run_enabled,
    scheduledRunCron: settings.scheduled_run_cron,
    scheduledRunNextRun: scheduledRunJob ? getNextRunDate(settings.scheduled_run_cron) : null,
    cleanupCron: settings.auto_clean_schedule,
    cleanupNextRun: cleanupJob ? getNextRunDate(settings.auto_clean_schedule) : null,
    queuedCount: getQueuedCount(),
  };
}

/**
 * Calculate next run date from cron expression
 */
function getNextRunDate(cronExpression: string): Date | null {
  try {
    // Simple implementation - parse cron parts and calculate next occurrence
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return null;
    
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);
    
    // Simple case: specific hour and minute
    if (!minute.includes('*') && !hour.includes('*')) {
      next.setMinutes(parseInt(minute, 10));
      next.setHours(parseInt(hour, 10));
      next.setSeconds(0);
      next.setMilliseconds(0);
      
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      
      return next;
    }
    
    // For complex expressions, return approximate
    return null;
  } catch {
    return null;
  }
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler(): void {
  if (scheduledRunJob) {
    scheduledRunJob.stop();
    scheduledRunJob = null;
  }
  
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
  }
  
  isInitialized = false;
  console.log('[Scheduler] All jobs stopped');
}
