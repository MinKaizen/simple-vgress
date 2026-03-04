// Run executor module
// Orchestrates screenshot capture and visual comparison

import { chromium, Browser } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuid } from 'uuid';
import { 
  Config, 
  expandPageJobs, 
  parseConfig, 
  generateTimestamp,
  urlToSlug,
  deviceToSlug,
  findScreenshots,
} from './utils';
import { checkPage, PageResult } from './worker';
import { compareImages, createSideBySideDiff, createDiffMask } from './differ';
import { 
  Run, 
  RunSummary, 
  RunResult,
  createRun, 
  updateRun, 
  getCurrentBaseline, 
  getBaselineById,
  TriggerType,
} from '@/lib/db';
import { getDataDir } from '@/lib/storage';

export type RunProgressCallback = (event: RunProgressEvent) => void;

export interface RunProgressEvent {
  type: 'started' | 'page_started' | 'page_completed' | 'comparison_started' | 'comparison_completed' | 'completed' | 'error';
  message: string;
  data?: {
    runId?: string;
    url?: string;
    device?: string;
    progress?: { current: number; total: number };
    result?: PageResult;
    comparisonResult?: RunResult;
  };
}

interface VisualComparisonResult {
  url: string;
  device: string;
  status: 'passed' | 'failed' | 'error';
  diffPercentage?: number;
  errorMessage?: string;
  screenshotParts: string[];
  diffImages: string[];
}

/**
 * Execute a visual regression run
 */
export async function executeRun(
  configYaml: string,
  triggerType: TriggerType,
  triggeredByUserId: string | null,
  triggeredByUserEmail: string | null,
  onProgress?: RunProgressCallback
): Promise<Run> {
  const runId = `run_${uuid()}`;
  const timestamp = generateTimestamp();
  const dataDir = getDataDir();
  const screenshotDir = path.join(dataDir, 'screenshots', 'runs', runId);
  
  // Ensure screenshot directory exists
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.join(screenshotDir, 'diffs'), { recursive: true });
  
  // Get current baseline
  const currentBaseline = getCurrentBaseline();
  
  // Create run record
  const run = createRun({
    id: runId,
    started_at: new Date().toISOString(),
    trigger_type: triggerType,
    triggered_by_user_id: triggeredByUserId,
    triggered_by_user_email: triggeredByUserEmail,
    status: 'running',
    baseline_id_at_run: currentBaseline?.id || null,
    config_snapshot: configYaml,
    screenshot_path: screenshotDir,
  });
  
  onProgress?.({
    type: 'started',
    message: `Run ${runId} started`,
    data: { runId },
  });
  
  let browser: Browser | null = null;
  
  try {
    // Parse config
    const config = parseConfig(configYaml);
    const jobs = expandPageJobs(config);
    
    // Launch browser
    browser = await chromium.launch({ headless: true });
    
    // Process jobs
    const pageResults: PageResult[] = [];
    const concurrency = 5;
    
    for (let i = 0; i < jobs.length; i += concurrency) {
      const batch = jobs.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (job, batchIndex) => {
        const jobIndex = i + batchIndex;
        
        onProgress?.({
          type: 'page_started',
          message: `Processing ${job.url} (${job.device})`,
          data: {
            runId,
            url: job.url,
            device: job.device,
            progress: { current: jobIndex + 1, total: jobs.length },
          },
        });
        
        const result = await checkPage(
          browser!,
          job.url,
          job.device,
          job.config,
          screenshotDir,
          (msg) => {
            onProgress?.({
              type: 'page_started',
              message: msg,
              data: { runId, url: job.url, device: job.device },
            });
          }
        );
        
        onProgress?.({
          type: 'page_completed',
          message: `Completed ${job.url} (${job.device}): ${result.success ? 'success' : 'failed'}`,
          data: {
            runId,
            url: job.url,
            device: job.device,
            result,
            progress: { current: jobIndex + 1, total: jobs.length },
          },
        });
        
        return result;
      });
      
      const batchResults = await Promise.all(batchPromises);
      pageResults.push(...batchResults);
    }
    
    await browser.close();
    browser = null;
    
    // Run visual comparison if baseline exists
    const comparisonResults: VisualComparisonResult[] = [];
    
    if (currentBaseline) {
      onProgress?.({
        type: 'comparison_started',
        message: 'Starting visual comparison...',
        data: { runId },
      });
      
      const baselineScreenshotDir = currentBaseline.screenshot_path;
      
      // Group page results by URL+device
      const urlDeviceGroups = new Map<string, PageResult>();
      for (const result of pageResults) {
        const key = `${result.url}::${result.device}`;
        urlDeviceGroups.set(key, result);
      }
      
      for (const [key, pageResult] of urlDeviceGroups) {
        const urlSlug = urlToSlug(pageResult.url);
        const deviceSlug = deviceToSlug(pageResult.device);
        
        // Get screenshots from current run
        const currentScreenshots = findScreenshots(screenshotDir, urlSlug, deviceSlug);
        
        // Get screenshots from baseline
        const baselineScreenshots = findScreenshots(baselineScreenshotDir, urlSlug, deviceSlug);
        
        if (baselineScreenshots.length === 0) {
          // No baseline for this URL+device
          comparisonResults.push({
            url: pageResult.url,
            device: pageResult.device,
            status: 'passed',
            screenshotParts: currentScreenshots,
            diffImages: [],
          });
          continue;
        }
        
        if (currentScreenshots.length !== baselineScreenshots.length) {
          // Different number of parts
          comparisonResults.push({
            url: pageResult.url,
            device: pageResult.device,
            status: 'failed',
            errorMessage: `Screenshot count mismatch: baseline has ${baselineScreenshots.length}, current has ${currentScreenshots.length}`,
            screenshotParts: currentScreenshots,
            diffImages: [],
          });
          continue;
        }
        
        // Compare each part
        let totalDiffPercentage = 0;
        let hasDiff = false;
        const diffImages: string[] = [];
        const config = parseConfig(configYaml);
        const threshold = config._default.visualRegressionThreshold;
        
        for (let i = 0; i < currentScreenshots.length; i++) {
          const currentPath = path.join(screenshotDir, currentScreenshots[i]);
          const baselinePath = path.join(baselineScreenshotDir, baselineScreenshots[i]);
          
          try {
            const comparison = await compareImages(baselinePath, currentPath);
            totalDiffPercentage += comparison.diffPercentage;
            
            if (comparison.diffPercentage > threshold) {
              hasDiff = true;
              
              // Generate diff images
              const diffBasename = currentScreenshots[i].replace('.png', '');
              const sideBySidePath = path.join(screenshotDir, 'diffs', `${diffBasename}-diff.png`);
              const maskPath = path.join(screenshotDir, 'diffs', `${diffBasename}-mask.png`);
              
              await createSideBySideDiff(baselinePath, currentPath, sideBySidePath);
              
              if (config._default.generateDiffMask) {
                await createDiffMask(baselinePath, currentPath, maskPath);
                diffImages.push(`${diffBasename}-mask.png`);
              }
              
              diffImages.push(`${diffBasename}-diff.png`);
            }
          } catch (error) {
            comparisonResults.push({
              url: pageResult.url,
              device: pageResult.device,
              status: 'error',
              errorMessage: error instanceof Error ? error.message : 'Unknown comparison error',
              screenshotParts: currentScreenshots,
              diffImages: [],
            });
            continue;
          }
        }
        
        const avgDiffPercentage = totalDiffPercentage / currentScreenshots.length;
        
        comparisonResults.push({
          url: pageResult.url,
          device: pageResult.device,
          status: hasDiff ? 'failed' : 'passed',
          diffPercentage: avgDiffPercentage,
          screenshotParts: currentScreenshots,
          diffImages,
        });
        
        onProgress?.({
          type: 'comparison_completed',
          message: `Compared ${pageResult.url} (${pageResult.device}): ${hasDiff ? 'diff detected' : 'match'}`,
          data: {
            runId,
            url: pageResult.url,
            device: pageResult.device,
            comparisonResult: {
              url: pageResult.url,
              device: pageResult.device,
              status: hasDiff ? 'failed' : 'passed',
              diffPercentage: avgDiffPercentage,
              screenshotParts: currentScreenshots,
              diffImages,
            },
          },
        });
      }
    } else {
      // No baseline - all results are "passed" (first run)
      for (const pageResult of pageResults) {
        const urlSlug = urlToSlug(pageResult.url);
        const deviceSlug = deviceToSlug(pageResult.device);
        const screenshots = findScreenshots(screenshotDir, urlSlug, deviceSlug);
        
        comparisonResults.push({
          url: pageResult.url,
          device: pageResult.device,
          status: pageResult.success ? 'passed' : 'error',
          errorMessage: pageResult.success ? undefined : pageResult.errors.join('; '),
          screenshotParts: screenshots,
          diffImages: [],
        });
      }
    }
    
    // Calculate summary
    const summary: RunSummary = {
      total: comparisonResults.length,
      passed: comparisonResults.filter(r => r.status === 'passed').length,
      failed: comparisonResults.filter(r => r.status === 'failed').length,
      errors: comparisonResults.filter(r => r.status === 'error').length,
    };
    
    const finalStatus = summary.failed > 0 || summary.errors > 0 ? 'failed' : 'success';
    
    // Convert comparison results to RunResult format
    const results: RunResult[] = comparisonResults.map(r => ({
      url: r.url,
      device: r.device,
      status: r.status,
      diffPercentage: r.diffPercentage,
      errorMessage: r.errorMessage,
      screenshotParts: r.screenshotParts,
      diffImages: r.diffImages,
    }));
    
    // Update run record
    const completedRun = updateRun(runId, {
      completed_at: new Date().toISOString(),
      status: finalStatus,
      summary_json: JSON.stringify(summary),
      results_json: JSON.stringify(results),
    });
    
    onProgress?.({
      type: 'completed',
      message: `Run completed: ${summary.passed} passed, ${summary.failed} failed, ${summary.errors} errors`,
      data: { runId },
    });
    
    return completedRun!;
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    const errorRun = updateRun(runId, {
      completed_at: new Date().toISOString(),
      status: 'error',
      error_message: errorMessage,
    });
    
    onProgress?.({
      type: 'error',
      message: `Run failed: ${errorMessage}`,
      data: { runId },
    });
    
    return errorRun!;
  }
}

/**
 * Promote a run to baseline
 */
export function promoteRunToBaseline(
  runId: string,
  userId: string | null,
  userEmail: string | null,
  reason: string
): void {
  const { createBaseline } = require('@/lib/db');
  const run = require('@/lib/db').getRunById(runId);
  
  if (!run || !run.screenshot_path) {
    throw new Error('Run not found or has no screenshots');
  }
  
  const dataDir = getDataDir();
  const baselineId = `baseline_${uuid()}`;
  const baselineDir = path.join(dataDir, 'screenshots', 'baselines', baselineId);
  
  // Copy screenshots to baseline directory
  fs.mkdirSync(baselineDir, { recursive: true });
  
  const runScreenshotDir = run.screenshot_path;
  const files = fs.readdirSync(runScreenshotDir);
  
  for (const file of files) {
    if (file.endsWith('.png') && !file.startsWith('temp-')) {
      const srcPath = path.join(runScreenshotDir, file);
      const destPath = path.join(baselineDir, file);
      fs.copyFileSync(srcPath, destPath);
    }
  }
  
  // Create baseline record
  createBaseline({
    id: baselineId,
    promoted_from_run_id: runId,
    promoted_by_user_id: userId,
    promoted_by_user_email: userEmail,
    promotion_reason: reason,
    screenshot_path: baselineDir,
  });
}
