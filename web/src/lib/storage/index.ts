// File storage management
// Handles screenshot storage, cleanup, and file operations

import * as fs from 'fs';
import * as path from 'path';
import { 
  getAllSettings, 
  getUnpromotedRunsOlderThan, 
  getFailedRuns, 
  getOldBaselines,
  deleteRun,
  deleteBaseline,
  Run,
  Baseline,
} from '@/lib/db';

/**
 * Get the data directory path
 */
export function getDataDir(): string {
  const dataDir = process.env.DATA_DIR || './data';
  
  // Ensure directory structure exists
  const dirs = [
    dataDir,
    path.join(dataDir, 'config'),
    path.join(dataDir, 'screenshots'),
    path.join(dataDir, 'screenshots', 'runs'),
    path.join(dataDir, 'screenshots', 'baselines'),
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  return dataDir;
}

/**
 * Get on-demand config file path
 */
export function getOnDemandConfigPath(): string {
  const dataDir = getDataDir();
  return path.join(dataDir, 'config', 'on-demand.yaml');
}

/**
 * Get scheduled config file path
 */
export function getScheduledConfigPath(): string {
  const dataDir = getDataDir();
  return path.join(dataDir, 'config', 'scheduled.yaml');
}

/**
 * Read config file, return default if not exists
 */
export function readConfigFile(configPath: string): string {
  if (fs.existsSync(configPath)) {
    return fs.readFileSync(configPath, 'utf-8');
  }
  
  // Return default config
  return `# Visual Regression Test Configuration

_default:
  fullPage: true
  devices: ["desktop", "mobile", "tablet"]
  timeoutMs: 30000
  requiredSelectors: []
  abortIfFail: false
  waitUntil: load
  waitFor: []
  scrollPage: true
  additionalWaitMs: 5000
  maxScreenshotHeight: 7000
  visualRegressionThreshold: 1.0
  generateDiffMask: true

pages:
  # Add your URLs here
  # https://example.com/:
  #   requiredSelectors:
  #     - "nav"
  #     - "footer"
`;
}

/**
 * Write config file
 */
export function writeConfigFile(configPath: string, content: string): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, content, 'utf-8');
}

/**
 * Delete a directory recursively
 */
function deleteDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Clean up unpromoted runs older than retention period
 * Also enforces baseline retention count
 */
export function runScheduledCleanup(): { runsDeleted: number; baselinesDeleted: number } {
  const settings = getAllSettings();
  
  // Delete old unpromoted runs
  const oldRuns = getUnpromotedRunsOlderThan(settings.unpromoted_run_retention_days);
  let runsDeleted = 0;
  
  for (const run of oldRuns) {
    if (run.screenshot_path) {
      deleteDirectory(run.screenshot_path);
    }
    deleteRun(run.id);
    runsDeleted++;
  }
  
  // Delete old baselines beyond retention count
  const oldBaselines = getOldBaselines(settings.baseline_retention_count);
  let baselinesDeleted = 0;
  
  for (const baseline of oldBaselines) {
    if (baseline.screenshot_path) {
      deleteDirectory(baseline.screenshot_path);
    }
    deleteBaseline(baseline.id);
    baselinesDeleted++;
  }
  
  return { runsDeleted, baselinesDeleted };
}

/**
 * Auto clean - only delete failed runs, never baselines or successful runs
 */
export function runAutoClean(): { runsDeleted: number } {
  const failedRuns = getFailedRuns();
  let runsDeleted = 0;
  
  for (const run of failedRuns) {
    if (run.screenshot_path) {
      deleteDirectory(run.screenshot_path);
    }
    deleteRun(run.id);
    runsDeleted++;
  }
  
  return { runsDeleted };
}

/**
 * Get screenshot file path for serving
 */
export function getScreenshotPath(type: 'run' | 'baseline', id: string, filename: string): string | null {
  const dataDir = getDataDir();
  const basePath = type === 'run' 
    ? path.join(dataDir, 'screenshots', 'runs', id)
    : path.join(dataDir, 'screenshots', 'baselines', id);
  
  const filePath = path.join(basePath, filename);
  
  // Security check: ensure path is within expected directory
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(basePath);
  
  if (!resolvedPath.startsWith(resolvedBase)) {
    return null;
  }
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  return filePath;
}

/**
 * List screenshot files in a run or baseline
 */
export function listScreenshots(type: 'run' | 'baseline', id: string): string[] {
  const dataDir = getDataDir();
  const dirPath = type === 'run'
    ? path.join(dataDir, 'screenshots', 'runs', id)
    : path.join(dataDir, 'screenshots', 'baselines', id);
  
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  
  const files = fs.readdirSync(dirPath);
  return files.filter(f => f.endsWith('.png') && !f.startsWith('temp-'));
}

/**
 * List diff files in a run
 */
export function listDiffs(runId: string): string[] {
  const dataDir = getDataDir();
  const diffDir = path.join(dataDir, 'screenshots', 'runs', runId, 'diffs');
  
  if (!fs.existsSync(diffDir)) {
    return [];
  }
  
  const files = fs.readdirSync(diffDir);
  return files.filter(f => f.endsWith('.png'));
}

/**
 * Get disk usage statistics
 */
export function getDiskUsage(): { runs: number; baselines: number; total: number } {
  const dataDir = getDataDir();
  
  const getDirectorySize = (dirPath: string): number => {
    if (!fs.existsSync(dirPath)) return 0;
    
    let size = 0;
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        size += getDirectorySize(filePath);
      } else {
        size += fs.statSync(filePath).size;
      }
    }
    
    return size;
  };
  
  const runsSize = getDirectorySize(path.join(dataDir, 'screenshots', 'runs'));
  const baselinesSize = getDirectorySize(path.join(dataDir, 'screenshots', 'baselines'));
  
  return {
    runs: runsSize,
    baselines: baselinesSize,
    total: runsSize + baselinesSize,
  };
}
