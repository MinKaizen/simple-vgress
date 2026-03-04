// SQLite Database Schema
export const SCHEMA = `
-- Users (synced from Google OAuth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  notify_all_runs INTEGER DEFAULT 0,
  notify_successful_runs INTEGER DEFAULT 0,
  notify_failed_runs INTEGER DEFAULT 0,
  notify_scheduled_runs INTEGER DEFAULT 0,
  notify_manual_runs INTEGER DEFAULT 0,
  email TEXT
);

-- Baselines
CREATE TABLE IF NOT EXISTS baselines (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  promoted_from_run_id TEXT REFERENCES runs(id),
  promoted_by_user_id TEXT REFERENCES users(id),
  promoted_by_user_email TEXT,
  promotion_reason TEXT NOT NULL,
  is_current INTEGER DEFAULT 0,
  screenshot_path TEXT NOT NULL
);

-- Runs
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  trigger_type TEXT NOT NULL,
  triggered_by_user_id TEXT REFERENCES users(id),
  triggered_by_user_email TEXT,
  status TEXT NOT NULL,
  baseline_id_at_run TEXT REFERENCES baselines(id),
  config_snapshot TEXT NOT NULL,
  screenshot_path TEXT,
  summary_json TEXT,
  results_json TEXT,
  error_message TEXT
);

-- Run queue (for preventing concurrent runs)
CREATE TABLE IF NOT EXISTS run_queue (
  id TEXT PRIMARY KEY,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  requested_by_user_id TEXT REFERENCES users(id),
  trigger_type TEXT NOT NULL,
  config_yaml TEXT NOT NULL,
  status TEXT DEFAULT 'queued'
);

-- App settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_baselines_is_current ON baselines(is_current);
CREATE INDEX IF NOT EXISTS idx_run_queue_status ON run_queue(status);
`;

// Default settings
export const DEFAULT_SETTINGS: Record<string, string> = {
  unpromoted_run_retention_days: '7',
  baseline_retention_count: '3',
  auto_clean_schedule: '0 3 * * *', // 3 AM daily
  scheduled_run_cron: '0 6 * * *', // 6 AM daily
  scheduled_run_enabled: 'true',
};
