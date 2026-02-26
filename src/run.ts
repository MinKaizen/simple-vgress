// Main entry point for the WordPress QA Screenshot Tool
// This file orchestrates the entire screenshot capture process

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Config, generateTimestamp, expandPageJobs, PageJob, urlToSlug, deviceToSlug, findScreenshots, truncateUrl, promptUser } from './utils';
import { checkPage, PageResult } from './worker';
import { checkBaseline, createBaselineSymlink, updateBaselineSymlink, getBaselineScreenshots } from './baseline';
import { compareImages, createSideBySideDiff, createDiffMask } from './differ';

const WORKER_CONCURRENCY = 5;

interface ComparisonResult {
  url: string;
  device: string;
  passed: boolean;
  baselineCount: number;
  currentCount: number;
  diffs: Array<{
    filename: string;
    diffPercentage: number;
  }>;
  warnings: string[];
  autoPass: boolean;
}

async function main() {
  console.log('🚀 WordPress QA Screenshot Tool\n');

  // 1. Parse CLI arguments
  const args = process.argv.slice(2);
  const updateBaselineFlag = args.includes('--update-baseline');

  // 2. Load config
  const configPath = path.join(process.cwd(), 'config.yaml');
  if (!fs.existsSync(configPath)) {
    console.error('❌ config.yaml not found');
    process.exit(1);
  }

  const configFile = fs.readFileSync(configPath, 'utf-8');
  const config: Config = yaml.parse(configFile);

  // Validate config
  if (!config._default || !config.pages) {
    console.error('❌ Invalid config.yaml format');
    process.exit(1);
  }

  // 3. Check baseline
  const baseline = checkBaseline();

  // Expand pages into individual jobs (URL + device combinations)
  const jobs = expandPageJobs(config);

  if (jobs.length === 0) {
    console.error('❌ No pages configured');
    process.exit(1);
  }

  const uniqueUrls = new Set(jobs.map(j => j.url)).size;
  const totalJobs = jobs.length;

  // 4. Handle baseline creation (first run)
  if (!baseline.exists || baseline.isEmpty) {
    console.log('📸 No baseline found. Creating initial baseline...\n');
    console.log(`📋 Found ${uniqueUrls} page(s) × devices = ${totalJobs} job(s) to process\n`);

    // Create timestamped folder
    const timestamp = generateTimestamp();
    const outputDir = path.join(process.cwd(), 'output', timestamp);
    fs.mkdirSync(outputDir, { recursive: true });

    // Launch browser and capture screenshots
    const browser = await chromium.launch({ headless: true });
    await captureScreenshots(browser, jobs, outputDir);
    await browser.close();

    // Create baseline symlink
    createBaselineSymlink(timestamp);

    console.log(`\n✅ Baseline created: output/baseline -> ${timestamp}\n`);
    process.exit(0);
  }

  // 5. Baseline exists - run normal flow with comparison
  console.log(`📸 Baseline found: ${baseline.path}\n`);
  console.log(`📋 Found ${uniqueUrls} page(s) × devices = ${totalJobs} job(s) to process\n`);

  // Create new timestamped folder
  const timestamp = generateTimestamp();
  const outputDir = path.join(process.cwd(), 'output', timestamp);
  fs.mkdirSync(outputDir, { recursive: true });

  // Launch browser and capture screenshots
  const browser = await chromium.launch({ headless: true });
  const captureResults = await captureScreenshots(browser, jobs, outputDir);
  await browser.close();

  // Check if any screenshot captures failed
  const captureFailures = captureResults.filter(r => !r.success);
  if (captureFailures.length > 0) {
    console.error('\n❌ Screenshot capture failed for some pages. Cannot proceed with visual regression.\n');
    console.error('Failed captures:');
    for (const failure of captureFailures) {
      console.error(`- ${failure.url} [${failure.device}]`);
      for (const error of failure.errors) {
        console.error(`  → ${error}`);
      }
    }
    process.exit(1);
  }

  // 6. Visual regression comparison
  console.log('\n🔍 Running visual regression tests...\n');
  const comparisonResults = await runVisualComparison(
    baseline.path!,
    outputDir,
    jobs
  );

  // 7. Print detailed report
  printVisualRegressionReport(comparisonResults, outputDir);

  // 8. Check if all passed
  const allPassed = comparisonResults.every(r => r.passed);

  // 9. Prompt for baseline update (if all passed)
  if (allPassed) {
    console.log('\n✅ All visual regression tests passed!\n');
    
    if (updateBaselineFlag) {
      updateBaselineSymlink(timestamp);
      console.log(`✅ Baseline updated: output/baseline -> ${timestamp}\n`);
    } else {
      const shouldUpdate = await promptUser('Would you like to update the baseline? (y/n): ');
      if (shouldUpdate) {
        updateBaselineSymlink(timestamp);
        console.log(`\n✅ Baseline updated: output/baseline -> ${timestamp}\n`);
      } else {
        console.log('\nBaseline not updated.\n');
      }
    }
  } else {
    console.log('\n❌ Visual regression tests failed. Baseline not updated.\n');
  }

  // 10. Always exit 0 (visual diffs are soft failures)
  process.exit(0);
}

/**
 * Capture screenshots for all jobs
 */
async function captureScreenshots(
  browser: any,
  jobs: PageJob[],
  outputDir: string
): Promise<PageResult[]> {
  const results: PageResult[] = [];
  let aborted = false;

  for (let i = 0; i < jobs.length; i += WORKER_CONCURRENCY) {
    if (aborted) break;

    const batch = jobs.slice(i, i + WORKER_CONCURRENCY);
    const batchPromises = batch.map((job) =>
      checkPage(browser, job.url, job.device, job.config, outputDir)
    );

    const batchResults = await Promise.all(batchPromises);

    // Check for abort-if-fail
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const job = batch[j];

      results.push(result);

      if (!result.success && job.config.abortIfFail) {
        console.log(`\n⚠️  Critical page failed (abortIfFail): ${result.url} [${result.device}]`);
        console.log('   Stopping remaining checks...\n');
        aborted = true;
        break;
      }
    }
  }

  // Print capture summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCREENSHOT CAPTURE SUMMARY');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const checked = results.length;

  const totalScreenshotFiles = results.reduce((sum, r) => {
    return sum + (r.screenshots ? r.screenshots.length : (r.screenshot ? 1 : 0));
  }, 0);

  console.log(`Jobs checked: ${checked}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Screenshot files: ${totalScreenshotFiles}\n`);

  // Show failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('❌ Failures:');
    for (const result of failures) {
      console.log(`- ${result.url} [${result.device}]`);
      for (const error of result.errors) {
        console.log(`  → ${error}`);
      }
    }
    console.log();
  }

  // Show warnings
  const withWarnings = results.filter(r => r.warnings.length > 0);
  if (withWarnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const result of withWarnings) {
      console.log(`- ${result.url} [${result.device}]`);
      for (const warning of result.warnings) {
        console.log(`  → ${warning}`);
      }
    }
    console.log();
  }

  console.log(`📸 Screenshots saved to:\n   ${outputDir}\n`);

  return results;
}

/**
 * Run visual comparison between baseline and current screenshots
 */
async function runVisualComparison(
  baselinePath: string,
  currentPath: string,
  jobs: PageJob[]
): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = [];
  const diffsDir = path.join(currentPath, 'diffs');

  // Group jobs by URL + device
  const jobsByUrlDevice = new Map<string, PageJob>();
  for (const job of jobs) {
    const key = `${job.url}::${job.device}`;
    jobsByUrlDevice.set(key, job);
  }

  // Get all baseline screenshots to detect orphaned URLs
  const baselineScreenshots = getBaselineScreenshots(baselinePath);
  const processedBaselineFiles = new Set<string>();

  for (const [, job] of jobsByUrlDevice) {
    const urlSlug = urlToSlug(job.url);
    const deviceSlug = deviceToSlug(job.device);
    const threshold = job.config.visualRegressionThreshold;

    // Find all screenshots for this URL+device in current run
    const currentScreenshots = findScreenshots(currentPath, urlSlug, deviceSlug);

    // Find matching baseline screenshots
    const baselineScreenshotsForJob = findScreenshots(baselinePath, urlSlug, deviceSlug);

    // Mark these baseline files as processed
    baselineScreenshotsForJob.forEach(f => processedBaselineFiles.add(f));

    // Handle missing baseline
    if (baselineScreenshotsForJob.length === 0) {
      results.push({
        url: job.url,
        device: job.device,
        passed: true,
        autoPass: true,
        baselineCount: 0,
        currentCount: currentScreenshots.length,
        diffs: [],
        warnings: ['No baseline found - auto passed']
      });
      continue;
    }

    // Handle mismatched counts
    const maxCount = Math.max(baselineScreenshotsForJob.length, currentScreenshots.length);

    const diffs: Array<{ filename: string; diffPercentage: number }> = [];
    const warnings: string[] = [];

    if (baselineScreenshotsForJob.length !== currentScreenshots.length) {
      warnings.push(
        `Screenshot count mismatch: baseline=${baselineScreenshotsForJob.length}, current=${currentScreenshots.length} - AUTO FAIL`
      );
    }

    // Compare each screenshot
    for (let i = 0; i < maxCount; i++) {
      const baselineFile = baselineScreenshotsForJob[i];
      const currentFile = currentScreenshots[i];

      // Both exist - compare
      if (baselineFile && currentFile) {
        try {
          const comparison = await compareImages(
            path.join(baselinePath, baselineFile),
            path.join(currentPath, currentFile)
          );

          if (comparison.diffPercentage > threshold) {
            // Create diff images
            fs.mkdirSync(diffsDir, { recursive: true });

            // Extract part info if multi-part (files use dots: filename.device.part1of2.png)
            let partSuffix = '';
            const partMatch = currentFile.match(/\.part(\d+of\d+)\.png$/);
            if (partMatch) {
              partSuffix = `-part${partMatch[1]}`;
            }

            const diffName = `${urlSlug}-${deviceSlug}${partSuffix}-diff.png`;
            await createSideBySideDiff(
              path.join(baselinePath, baselineFile),
              path.join(currentPath, currentFile),
              path.join(diffsDir, diffName)
            );

            if (job.config.generateDiffMask) {
              const maskName = `${urlSlug}-${deviceSlug}${partSuffix}-mask.png`;
              await createDiffMask(
                path.join(baselinePath, baselineFile),
                path.join(currentPath, currentFile),
                path.join(diffsDir, maskName)
              );
            }

            diffs.push({
              filename: currentFile,
              diffPercentage: comparison.diffPercentage
            });
          }
        } catch (error: any) {
          if (error.message && error.message.includes('corrupted')) {
            warnings.push(`Corrupted baseline: ${baselineFile} (deleted)`);
            // Delete corrupted baseline
            fs.unlinkSync(path.join(baselinePath, baselineFile));
          } else {
            throw error;
          }
        }
      }
      // One missing - count mismatch already flagged as warning
    }

    // If count mismatch, auto-fail
    const countMismatch = baselineScreenshotsForJob.length !== currentScreenshots.length;

    results.push({
      url: job.url,
      device: job.device,
      passed: diffs.length === 0 && !countMismatch && warnings.filter(w => !w.includes('auto passed')).length === 0,
      autoPass: false,
      baselineCount: baselineScreenshotsForJob.length,
      currentCount: currentScreenshots.length,
      diffs,
      warnings
    });
  }

  // Check for orphaned baseline screenshots (URLs removed from config)
  const orphanedWarnings: string[] = [];
  for (const baselineFile of baselineScreenshots) {
    if (!processedBaselineFiles.has(baselineFile)) {
      // Extract URL and device from filename
      const match = baselineFile.match(/^(.+)-([^-]+)(-part\d+of\d+)?\.png$/);
      if (match) {
        const info = `${baselineFile} exists in baseline but not in current run`;
        if (!orphanedWarnings.includes(info)) {
          orphanedWarnings.push(info);
        }
      }
    }
  }

  // Store orphaned warnings for display in report
  if (orphanedWarnings.length > 0) {
    // Add to a global warnings list that will be displayed
    (results as any).orphanedWarnings = orphanedWarnings;
  }

  return results;
}

/**
 * Print detailed visual regression report
 */
function printVisualRegressionReport(results: ComparisonResult[], outputDir: string): void {
  console.log('='.repeat(60));
  console.log('🔍 VISUAL REGRESSION RESULTS');
  console.log('='.repeat(60) + '\n');

  // Print detailed per-URL results
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.url} [${result.device}]`);

    if (result.autoPass) {
      console.log('   Auto-passed: No baseline found (not added to baseline)');
    } else if (result.diffs.length === 0 && result.passed) {
      console.log(`   ✓ All screenshots match (${result.currentCount} screenshot${result.currentCount !== 1 ? 's' : ''})`);
    } else {
      for (const diff of result.diffs) {
        console.log(`   ✗ ${diff.filename} (${diff.diffPercentage.toFixed(2)}% difference - FAILED)`);
      }
    }

    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(`   ⚠️  ${warning}`);
      }
    }

    console.log();
  }

  // Print summary table
  console.log('='.repeat(60));
  console.log('📊 SUMMARY TABLE');
  console.log('='.repeat(60) + '\n');

  // Table header with proper spacing
  const urlWidth = 32;
  const deviceWidth = 11;
  const statusWidth = 8;
  const diffsWidth = 10;
  const baselineWidth = 11;
  const currentWidth = 8;

  console.log(
    'URL'.padEnd(urlWidth) +
    'Device'.padEnd(deviceWidth) +
    'Status'.padEnd(statusWidth) +
    'Diffs'.padEnd(diffsWidth) +
    'Baseline'.padEnd(baselineWidth) +
    'Current'
  );
  console.log('-'.repeat(urlWidth + deviceWidth + statusWidth + diffsWidth + baselineWidth + currentWidth));

  for (const result of results) {
    const truncatedUrl = truncateUrl(result.url, urlWidth - 1);
    const status = result.passed ? 'PASS' : 'FAIL';
    const diffsText = result.baselineCount === result.currentCount
      ? `${result.diffs.length}/${result.currentCount}`
      : '-';

    console.log(
      truncatedUrl.padEnd(urlWidth) +
      result.device.padEnd(deviceWidth) +
      status.padEnd(statusWidth) +
      diffsText.padEnd(diffsWidth) +
      result.baselineCount.toString().padEnd(baselineWidth) +
      result.currentCount.toString()
    );
  }

  console.log();

  // Overall stats
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Overall: ${results.length} URL-device combination${results.length !== 1 ? 's' : ''} tested`);
  console.log(`         ${passed} passed ✅`);
  console.log(`         ${failed} failed ❌\n`);

  // Diff images location
  const diffsDir = path.join(outputDir, 'diffs');
  if (fs.existsSync(diffsDir)) {
    console.log(`💾 Diff images: ${diffsDir}\n`);
  }

  // Orphaned warnings
  const orphanedWarnings = (results as any).orphanedWarnings;
  if (orphanedWarnings && orphanedWarnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const warning of orphanedWarnings) {
      console.log(`   - ${warning}`);
    }
    console.log();
  }
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
