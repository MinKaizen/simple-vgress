// Worker module for processing individual pages
// Handles page loading, error detection, and screenshot capture

import { Browser, Page, devices } from 'playwright';
import { PageConfig, DeviceName, urlToSlug, deviceToSlug, formatDuration } from './utils';
import * as path from 'path';

export interface PageResult {
  url: string;
  device: DeviceName;
  success: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
  screenshot?: string;
}

/**
 * Check a single page with a specific device and capture screenshot
 */
export async function checkPage(
  browser: Browser,
  url: string,
  device: DeviceName,
  config: PageConfig,
  outputDir: string
): Promise<PageResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  let screenshot: string | undefined;

  let page: Page | null = null;
  
  try {
    // Create context with appropriate viewport
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

    // Track page errors
    page.on('pageerror', (error) => {
      if (!shouldIgnoreConsoleError(error.message)) {
        consoleErrors.push(error.message);
      }
    });

    // Track network failures (excluding common 3rd-party analytics)
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
    const navigationStart = Date.now();
    const response = await page.goto(url, {
      waitUntil: config.waitUntil,
      timeout: config.timeoutMs,
    });
    const navigationTime = Date.now() - navigationStart;

    // Check response status
    if (!response || response.status() !== 200) {
      errors.push(`Status ${response?.status() || 'unknown'}`);
    } else {
      // Wait for specific elements if configured
      if (config.waitFor && config.waitFor.length > 0) {
        for (const selector of config.waitFor) {
          try {
            await page.waitForSelector(selector, {
              state: 'visible',
              timeout: 30000,  // 30 second timeout for each waitFor selector
            });
          } catch (error) {
            warnings.push(`waitFor selector not visible within 30s: ${selector}`);
          }
        }
      }

      // Scroll entire page to trigger CSS animations and transitions
      if (config.scrollPage) {
        await scrollEntirePage(page);
      }

      // Additional 5 second wait after all loading/scrolling
      await page.waitForTimeout(5000);

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

      // Load time warning (5+ seconds)
      if (navigationTime > 5000) {
        warnings.push(`Slow page: ${formatDuration(navigationTime)}s`);
      }

      // Take screenshot
      const urlSlug = urlToSlug(url);
      const deviceSlug = deviceToSlug(device);
      const filename = `${urlSlug}.${deviceSlug}.png`;
      const screenshotPath = path.join(outputDir, filename);
      
      await page.screenshot({
        path: screenshotPath,
        fullPage: config.fullPage,
      });

      screenshot = filename;
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
  };
}

/**
 * Scroll through entire page to trigger CSS animations and lazy-loaded content
 */
async function scrollEntirePage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise((resolve: any) => {
      let totalHeight = 0;
      const distance = 100;  // Scroll 100px at a time
      
      const timer = setInterval(() => {
        // @ts-ignore
        const scrollHeight = document.body.scrollHeight;
        // @ts-ignore
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          // Scroll back to top
          // @ts-ignore
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);  // Scroll every 100ms
    });
  });
}

/**
 * Get Playwright device options based on device name
 */
function getDeviceOptions(device: DeviceName): any {
  // Handle common shorthand device names
  switch (device.toLowerCase()) {
    case 'desktop':
      return { viewport: { width: 1280, height: 800 } };
    
    case 'mobile':
      return devices['iPhone 13'];
    
    case 'tablet':
      return devices['iPad Pro'];
    
    default:
      // Try to use as a Playwright device name
      if (devices[device]) {
        return devices[device];
      }
      // Fallback to desktop if not recognized
      console.warn(`Unknown device "${device}", falling back to desktop`);
      return { viewport: { width: 1280, height: 800 } };
  }
}
