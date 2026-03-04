// Worker module for processing individual pages
// Handles page loading, error detection, and screenshot capture

import { Browser, Page, devices } from 'playwright';
import { PageConfig, DeviceName, urlToSlug, deviceToSlug, formatDuration } from './utils';
import * as path from 'path';
import * as fs from 'fs';

export interface PageResult {
  url: string;
  device: DeviceName;
  success: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
  screenshot?: string;
  screenshots?: string[];
}

/**
 * Check a single page with a specific device and capture screenshot
 */
export async function checkPage(
  browser: Browser,
  url: string,
  device: DeviceName,
  config: PageConfig,
  outputDir: string,
  onProgress?: (message: string) => void
): Promise<PageResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  let screenshot: string | undefined;
  let screenshots: string[] = [];

  let page: Page | null = null;
  
  const log = (msg: string) => {
    if (onProgress) onProgress(msg);
  };
  
  try {
    log(`Creating context for ${device}...`);
    const contextOptions = getDeviceOptions(device);
    const context = await browser.newContext(contextOptions);
    page = await context.newPage();

    // Track console errors (filter out generic 3rd-party errors)
    const consoleErrors: string[] = [];
    const genericErrorPatterns = [
      'Failed to load resource: the server responded with a status of 401',
      'Failed to load resource: the server responded with a status of 403',
      'Content Security Policy',
      'CSP',
    ];

    const shouldIgnoreConsoleError = (text: string) => {
      return genericErrorPatterns.some(pattern => text.includes(pattern));
    };

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !shouldIgnoreConsoleError(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      if (!shouldIgnoreConsoleError(error.message)) {
        consoleErrors.push(error.message);
      }
    });

    // Track network failures
    const networkFailures: string[] = [];
    const ignorePatterns = [
      'google-analytics.com',
      'googletagmanager.com',
      'analytics.google.com',
      'doubleclick.net',
      'facebook.com',
      'facebook.net',
      'linkedin.com',
      'twitter.com',
      'google.com/ccm',
      'ads.linkedin.com',
      'recaptcha',
      'csp.withgoogle.com',
    ];

    const shouldIgnoreUrl = (url: string) => {
      return ignorePatterns.some(pattern => url.includes(pattern));
    };

    page.on('response', (response) => {
      if (response.status() >= 400 && !shouldIgnoreUrl(response.url())) {
        networkFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    page.on('requestfailed', (request) => {
      if (!shouldIgnoreUrl(request.url())) {
        networkFailures.push(`Failed: ${request.url()}`);
      }
    });

    // Navigate to page
    log(`Navigating to ${url}...`);
    const navigationStart = Date.now();
    const response = await page.goto(url, {
      waitUntil: config.waitUntil,
      timeout: config.timeoutMs,
    });
    const navigationTime = Date.now() - navigationStart;
    log(`Navigation completed in ${formatDuration(navigationTime)}s`);

    // Check response status
    if (!response || response.status() !== 200) {
      errors.push(`Status ${response?.status() || 'unknown'}`);
    } else {
      // Wait for specific elements if configured
      if (config.waitFor && config.waitFor.length > 0) {
        log(`Waiting for ${config.waitFor.length} selectors...`);
        for (const selector of config.waitFor) {
          try {
            await page.waitForSelector(selector, {
              state: 'visible',
              timeout: 30000,
            });
          } catch {
            warnings.push(`waitFor selector not visible within 30s: ${selector}`);
          }
        }
      }

      // Scroll entire page
      if (config.scrollPage) {
        log('Scrolling page...');
        await scrollEntirePage(page);
      }

      // Additional wait
      if (config.additionalWaitMs > 0) {
        log(`Waiting additional ${config.additionalWaitMs}ms...`);
        await page.waitForTimeout(config.additionalWaitMs);
      }

      // Check for console errors
      if (consoleErrors.length > 0) {
        errors.push(`Console errors: ${consoleErrors.join('; ')}`);
      }

      // Check for network failures
      if (networkFailures.length > 0) {
        errors.push(`Network failures: ${networkFailures.join('; ')}`);
      }

      // Check required selectors
      for (const selector of config.requiredSelectors) {
        const element = await page.$(selector);
        if (!element) {
          errors.push(`Missing selector: ${selector}`);
        }
      }

      // Load time warning
      if (navigationTime > 5000) {
        warnings.push(`Slow page: ${formatDuration(navigationTime)}s`);
      }

      // Take screenshot(s)
      log('Capturing screenshot...');
      const urlSlug = urlToSlug(url);
      const deviceSlug = deviceToSlug(device);
      
      if (config.fullPage && config.maxScreenshotHeight !== null) {
        screenshots = await captureMultiPartScreenshots(
          page,
          urlSlug,
          deviceSlug,
          config.maxScreenshotHeight,
          outputDir
        );
        screenshot = screenshots.length > 0 ? screenshots[0] : undefined;
        log(`Captured ${screenshots.length} screenshot parts`);
      } else {
        const filename = `${urlSlug}.${deviceSlug}.png`;
        const screenshotPath = path.join(outputDir, filename);
        
        await page.screenshot({
          path: screenshotPath,
          fullPage: config.fullPage,
        });

        screenshot = filename;
        screenshots = [filename];
        log('Captured single screenshot');
      }
    }

    await context.close();

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Timeout')) {
        errors.push('Timeout exceeded');
      } else {
        errors.push(error.message);
      }
    } else {
      errors.push('Unknown error');
    }
  }

  const duration = Date.now() - startTime;

  return {
    url,
    device,
    success: errors.length === 0,
    errors,
    warnings,
    duration,
    screenshot,
    screenshots: screenshots.length > 1 ? screenshots : undefined,
  };
}

/**
 * Capture multi-part screenshots
 */
async function captureMultiPartScreenshots(
  page: Page,
  urlSlug: string,
  deviceSlug: string,
  maxHeight: number,
  outputDir: string
): Promise<string[]> {
  const screenshots: string[] = [];
  const { Jimp } = await import('jimp');
  
  // Get page dimensions
  const dimensions = await page.evaluate(() => {
    const height = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    const width = Math.max(
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth
    );
    return { height, width };
  });

  const pageHeight = dimensions.height;

  // If page height is less than or equal to max, take single screenshot
  if (pageHeight <= maxHeight) {
    const filename = `${urlSlug}.${deviceSlug}.png`;
    const screenshotPath = path.join(outputDir, filename);
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    
    return [filename];
  }

  // Calculate number of parts needed
  const partHeight = maxHeight;
  const numParts = Math.ceil(pageHeight / maxHeight);

  // Take full-page screenshot
  const tempFullPath = path.join(outputDir, `temp-full-${Date.now()}.png`);
  await page.screenshot({
    path: tempFullPath,
    fullPage: true,
  });

  // Load the full image with Jimp
  const fullImage = await Jimp.read(tempFullPath);
  
  // Split into parts
  for (let i = 0; i < numParts; i++) {
    const startY = i * partHeight;
    const actualHeight = Math.min(partHeight, pageHeight - startY);
    
    const filename = `${urlSlug}.${deviceSlug}.part${i + 1}of${numParts}.png`;
    const screenshotPath = path.join(outputDir, filename);
    
    const croppedImage = fullImage.clone().crop({
      x: 0,
      y: startY,
      w: fullImage.bitmap.width,
      h: actualHeight
    });
    await croppedImage.write(screenshotPath as `${string}.${string}`);
    
    screenshots.push(filename);
  }

  // Delete the temporary full screenshot
  fs.unlinkSync(tempFullPath);

  return screenshots;
}

/**
 * Scroll through entire page
 */
async function scrollEntirePage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Get Playwright device options
 */
function getDeviceOptions(device: DeviceName): Record<string, unknown> {
  switch (device.toLowerCase()) {
    case 'desktop':
      return { viewport: { width: 1280, height: 800 } };
    
    case 'mobile':
      return devices['iPhone 13'];
    
    case 'tablet':
      return devices['iPad Pro'];
    
    default:
      if (devices[device]) {
        return devices[device];
      }
      console.warn(`Unknown device "${device}", falling back to desktop`);
      return { viewport: { width: 1280, height: 800 } };
  }
}
