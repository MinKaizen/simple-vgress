import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SCHEMA, DEFAULT_SETTINGS } from './schema';

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DATA_DIR, 'app.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Create singleton database instance
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // Initialize schema
    db.exec(SCHEMA);
    
    // Run migrations for existing databases
    runMigrations(db);
    
    // Insert default settings if not exist
    const insertSetting = db.prepare(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
    );
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(key, value);
    }
  }
  return db;
}

// Run database migrations for existing databases
function runMigrations(db: Database.Database): void {
  // Check if password_hash column exists in users table
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const hasPasswordHash = tableInfo.some(col => col.name === 'password_hash');
  
  if (!hasPasswordHash) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
    console.log('Migration: Added password_hash column to users table');
  }
}

// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface NotificationPreferences {
  user_id: string;
  notify_all_runs: boolean;
  notify_successful_runs: boolean;
  notify_failed_runs: boolean;
  notify_scheduled_runs: boolean;
  notify_manual_runs: boolean;
  email: string | null;
}

// Baseline types
export interface Baseline {
  id: string;
  created_at: string;
  promoted_from_run_id: string | null;
  promoted_by_user_id: string | null;
  promoted_by_user_email: string | null;
  promotion_reason: string;
  is_current: boolean;
  screenshot_path: string;
}

// Run types
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'error';
export type TriggerType = 'manual' | 'scheduled';

export interface Run {
  id: string;
  started_at: string;
  completed_at: string | null;
  trigger_type: TriggerType;
  triggered_by_user_id: string | null;
  triggered_by_user_email: string | null;
  status: RunStatus;
  baseline_id_at_run: string | null;
  config_snapshot: string;
  screenshot_path: string | null;
  summary_json: string | null;
  results_json: string | null;
  error_message: string | null;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  errors: number;
}

export interface RunResult {
  url: string;
  device: string;
  status: 'passed' | 'failed' | 'error';
  diffPercentage?: number;
  errorMessage?: string;
  screenshotParts: string[];
  diffImages?: string[];
}

// Run queue types
export interface RunQueueItem {
  id: string;
  requested_at: string;
  requested_by_user_id: string | null;
  trigger_type: TriggerType;
  config_yaml: string;
  status: 'queued' | 'processing' | 'completed' | 'cancelled';
}

// Settings types
export interface Settings {
  unpromoted_run_retention_days: number;
  baseline_retention_count: number;
  auto_clean_schedule: string;
  scheduled_run_cron: string;
  scheduled_run_enabled: boolean;
}

// User operations
export function upsertUser(user: Omit<User, 'created_at'>): User {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as User | undefined;
  
  if (existing) {
    db.prepare(`
      UPDATE users 
      SET email = ?, name = ?, avatar_url = ?, password_hash = COALESCE(?, password_hash), last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.email, user.name, user.avatar_url, user.password_hash, user.id);
  } else {
    db.prepare(`
      INSERT INTO users (id, email, name, avatar_url, password_hash, last_login_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(user.id, user.email, user.name, user.avatar_url, user.password_hash);
  }
  
  return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as User;
}

export function getUserById(id: string): User | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByEmail(email: string): User | undefined {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

// Notification preferences
export function getNotificationPreferences(userId: string): NotificationPreferences | undefined {
  const row = getDb().prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(userId) as {
    user_id: string;
    notify_all_runs: number;
    notify_successful_runs: number;
    notify_failed_runs: number;
    notify_scheduled_runs: number;
    notify_manual_runs: number;
    email: string | null;
  } | undefined;
  
  if (!row) return undefined;
  
  return {
    user_id: row.user_id,
    notify_all_runs: Boolean(row.notify_all_runs),
    notify_successful_runs: Boolean(row.notify_successful_runs),
    notify_failed_runs: Boolean(row.notify_failed_runs),
    notify_scheduled_runs: Boolean(row.notify_scheduled_runs),
    notify_manual_runs: Boolean(row.notify_manual_runs),
    email: row.email,
  };
}

export function upsertNotificationPreferences(prefs: NotificationPreferences): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO notification_preferences 
    (user_id, notify_all_runs, notify_successful_runs, notify_failed_runs, notify_scheduled_runs, notify_manual_runs, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    prefs.user_id,
    prefs.notify_all_runs ? 1 : 0,
    prefs.notify_successful_runs ? 1 : 0,
    prefs.notify_failed_runs ? 1 : 0,
    prefs.notify_scheduled_runs ? 1 : 0,
    prefs.notify_manual_runs ? 1 : 0,
    prefs.email
  );
}

// Baseline operations
export function getCurrentBaseline(): Baseline | undefined {
  const row = getDb().prepare('SELECT * FROM baselines WHERE is_current = 1').get() as {
    id: string;
    created_at: string;
    promoted_from_run_id: string | null;
    promoted_by_user_id: string | null;
    promoted_by_user_email: string | null;
    promotion_reason: string;
    is_current: number;
    screenshot_path: string;
  } | undefined;
  
  if (!row) return undefined;
  
  return {
    ...row,
    is_current: Boolean(row.is_current),
  };
}

export function getBaselineById(id: string): Baseline | undefined {
  const row = getDb().prepare('SELECT * FROM baselines WHERE id = ?').get(id) as {
    id: string;
    created_at: string;
    promoted_from_run_id: string | null;
    promoted_by_user_id: string | null;
    promoted_by_user_email: string | null;
    promotion_reason: string;
    is_current: number;
    screenshot_path: string;
  } | undefined;
  
  if (!row) return undefined;
  
  return {
    ...row,
    is_current: Boolean(row.is_current),
  };
}

export function getAllBaselines(): Baseline[] {
  const rows = getDb().prepare('SELECT * FROM baselines ORDER BY created_at DESC').all() as Array<{
    id: string;
    created_at: string;
    promoted_from_run_id: string | null;
    promoted_by_user_id: string | null;
    promoted_by_user_email: string | null;
    promotion_reason: string;
    is_current: number;
    screenshot_path: string;
  }>;
  
  return rows.map(row => ({
    ...row,
    is_current: Boolean(row.is_current),
  }));
}

export function createBaseline(baseline: Omit<Baseline, 'created_at' | 'is_current'>): Baseline {
  const db = getDb();
  
  // Set all other baselines to not current
  db.prepare('UPDATE baselines SET is_current = 0').run();
  
  // Insert new baseline
  db.prepare(`
    INSERT INTO baselines (id, promoted_from_run_id, promoted_by_user_id, promoted_by_user_email, promotion_reason, is_current, screenshot_path)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(
    baseline.id,
    baseline.promoted_from_run_id,
    baseline.promoted_by_user_id,
    baseline.promoted_by_user_email,
    baseline.promotion_reason,
    baseline.screenshot_path
  );
  
  return getBaselineById(baseline.id)!;
}

export function restoreBaseline(id: string): Baseline | undefined {
  const db = getDb();
  
  // Set all baselines to not current
  db.prepare('UPDATE baselines SET is_current = 0').run();
  
  // Set the specified baseline as current
  db.prepare('UPDATE baselines SET is_current = 1 WHERE id = ?').run(id);
  
  return getBaselineById(id);
}

// Run operations
export function createRun(run: Omit<Run, 'completed_at' | 'summary_json' | 'results_json' | 'error_message'>): Run {
  getDb().prepare(`
    INSERT INTO runs (id, started_at, trigger_type, triggered_by_user_id, triggered_by_user_email, status, baseline_id_at_run, config_snapshot, screenshot_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    run.id,
    run.started_at,
    run.trigger_type,
    run.triggered_by_user_id,
    run.triggered_by_user_email,
    run.status,
    run.baseline_id_at_run,
    run.config_snapshot,
    run.screenshot_path
  );
  
  return getRunById(run.id)!;
}

export function updateRun(id: string, updates: Partial<Run>): Run | undefined {
  const db = getDb();
  const setClauses: string[] = [];
  const values: (string | null)[] = [];
  
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    values.push(updates.status);
  }
  if (updates.completed_at !== undefined) {
    setClauses.push('completed_at = ?');
    values.push(updates.completed_at);
  }
  if (updates.summary_json !== undefined) {
    setClauses.push('summary_json = ?');
    values.push(updates.summary_json);
  }
  if (updates.results_json !== undefined) {
    setClauses.push('results_json = ?');
    values.push(updates.results_json);
  }
  if (updates.error_message !== undefined) {
    setClauses.push('error_message = ?');
    values.push(updates.error_message);
  }
  if (updates.screenshot_path !== undefined) {
    setClauses.push('screenshot_path = ?');
    values.push(updates.screenshot_path);
  }
  
  if (setClauses.length === 0) return getRunById(id);
  
  values.push(id);
  db.prepare(`UPDATE runs SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  
  return getRunById(id);
}

export function getRunById(id: string): Run | undefined {
  return getDb().prepare('SELECT * FROM runs WHERE id = ?').get(id) as Run | undefined;
}

export function getAllRuns(limit = 50, offset = 0): Run[] {
  return getDb().prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ? OFFSET ?').all(limit, offset) as Run[];
}

export function getRunsCount(): number {
  const result = getDb().prepare('SELECT COUNT(*) as count FROM runs').get() as { count: number };
  return result.count;
}

export function getRunningRun(): Run | undefined {
  return getDb().prepare("SELECT * FROM runs WHERE status = 'running'").get() as Run | undefined;
}

// Run queue operations
export function addToQueue(item: Omit<RunQueueItem, 'requested_at' | 'status'>): RunQueueItem {
  getDb().prepare(`
    INSERT INTO run_queue (id, requested_by_user_id, trigger_type, config_yaml)
    VALUES (?, ?, ?, ?)
  `).run(item.id, item.requested_by_user_id, item.trigger_type, item.config_yaml);
  
  return getDb().prepare('SELECT * FROM run_queue WHERE id = ?').get(item.id) as RunQueueItem;
}

export function getNextQueuedItem(): RunQueueItem | undefined {
  return getDb().prepare("SELECT * FROM run_queue WHERE status = 'queued' ORDER BY requested_at ASC LIMIT 1").get() as RunQueueItem | undefined;
}

export function updateQueueItem(id: string, status: RunQueueItem['status']): void {
  getDb().prepare('UPDATE run_queue SET status = ? WHERE id = ?').run(status, id);
}

export function getQueuedCount(): number {
  const result = getDb().prepare("SELECT COUNT(*) as count FROM run_queue WHERE status = 'queued'").get() as { count: number };
  return result.count;
}

export function isRunInProgress(): boolean {
  const running = getDb().prepare("SELECT COUNT(*) as count FROM runs WHERE status = 'running'").get() as { count: number };
  const processing = getDb().prepare("SELECT COUNT(*) as count FROM run_queue WHERE status = 'processing'").get() as { count: number };
  return running.count > 0 || processing.count > 0;
}

// Settings operations
export function getSetting(key: string): string | undefined {
  const result = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return result?.value;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings(): Settings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const settingsMap: Record<string, string> = {};
  for (const row of rows) {
    settingsMap[row.key] = row.value;
  }
  
  return {
    unpromoted_run_retention_days: parseInt(settingsMap.unpromoted_run_retention_days || '7', 10),
    baseline_retention_count: parseInt(settingsMap.baseline_retention_count || '3', 10),
    auto_clean_schedule: settingsMap.auto_clean_schedule || '0 3 * * *',
    scheduled_run_cron: settingsMap.scheduled_run_cron || '0 6 * * *',
    scheduled_run_enabled: settingsMap.scheduled_run_enabled !== 'false',
  };
}

// Users who should receive notifications for a run
export function getUsersForNotification(run: Run): User[] {
  const db = getDb();
  
  const query = `
    SELECT u.* FROM users u
    JOIN notification_preferences np ON u.id = np.user_id
    WHERE np.notify_all_runs = 1
       OR (np.notify_successful_runs = 1 AND ? = 'success')
       OR (np.notify_failed_runs = 1 AND ? = 'failed')
       OR (np.notify_scheduled_runs = 1 AND ? = 'scheduled')
       OR (np.notify_manual_runs = 1 AND ? = 'manual')
  `;
  
  return db.prepare(query).all(
    run.status,
    run.status,
    run.trigger_type,
    run.trigger_type
  ) as User[];
}

// Cleanup operations
export function getUnpromotedRunsOlderThan(days: number): Run[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString();
  
  // Get runs that haven't been promoted to baseline
  return getDb().prepare(`
    SELECT r.* FROM runs r
    LEFT JOIN baselines b ON r.id = b.promoted_from_run_id
    WHERE b.id IS NULL
      AND r.started_at < ?
  `).all(cutoffStr) as Run[];
}

export function getFailedRuns(): Run[] {
  return getDb().prepare("SELECT * FROM runs WHERE status = 'failed' OR status = 'error'").all() as Run[];
}

export function deleteRun(id: string): void {
  getDb().prepare('DELETE FROM runs WHERE id = ?').run(id);
}

export function getOldBaselines(keepCount: number): Baseline[] {
  // Get all non-current baselines beyond the keep count
  return getDb().prepare(`
    SELECT * FROM baselines 
    WHERE is_current = 0 
    ORDER BY created_at DESC
    LIMIT -1 OFFSET ?
  `).all(keepCount - 1) as Baseline[];
}

export function deleteBaseline(id: string): void {
  getDb().prepare('DELETE FROM baselines WHERE id = ?').run(id);
}
