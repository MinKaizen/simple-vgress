// Main entry point for the WordPress QA Screenshot Tool
// This file orchestrates the entire screenshot capture process

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Config, generateTimestamp, expandPageJobs } from './utils';
import { checkPage, PageResult } from './worker';

const WORKER_CONCURRENCY = 5;

async function main() {
  console.log('🚀 WordPress QA Screenshot Tool\n');

  // Load config
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

  // Expand pages into individual jobs (URL + device combinations)
  const jobs = expandPageJobs(config);

  if (jobs.length === 0) {
    console.error('❌ No pages configured');
    process.exit(1);
  }

  const uniqueUrls = new Set(jobs.map(j => j.url)).size;
  const totalJobs = jobs.length;
  
  console.log(`📋 Found ${uniqueUrls} page(s) × devices = ${totalJobs} job(s) to process\n`);

  // Create output directory
  const timestamp = generateTimestamp();
  const outputDir = path.join(process.cwd(), 'output', timestamp);
  fs.mkdirSync(outputDir, { recursive: true });

  // Launch browser
  const browser = await chromium.launch({ headless: true });

  // Process jobs with concurrency
  const results: PageResult[] = [];
  let aborted = false;

  try {
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
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
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

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
