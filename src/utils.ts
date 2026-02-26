// Utility functions
// URL slugging, file naming, config merging, etc.

export type DeviceName = string; // 'desktop', 'mobile', 'tablet', or any Playwright device name
export type WaitUntilOption = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export interface PageConfig {
  fullPage: boolean;
  devices: DeviceName[];
  timeoutMs: number;
  requiredSelectors: string[];
  abortIfFail: boolean;
  waitUntil: WaitUntilOption;
  waitFor: string[];  // CSS selectors to wait for before taking screenshot
  scrollPage: boolean;  // Scroll the entire page to trigger CSS animations/transitions before screenshot
  maxScreenshotHeight: number | null;  // Max height per screenshot part (null = no splitting, default 7000)
  visualRegressionThreshold: number;  // Pixel difference threshold percentage (default 1.0 = 1%)
  generateDiffMask: boolean;  // Generate traditional diff mask image (default true)
}

export interface Config {
  _default: PageConfig;
  pages: Record<string, Partial<PageConfig>>;
}

export interface PageJob {
  url: string;
  device: DeviceName;
  config: PageConfig;
}

/**
 * Generate timestamp folder name in format: YYYY-MM-DD-HHmm
 */
export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}`;
}

/**
 * Convert URL to slug for filename
 * Examples:
 * - https://example.com/ → example-com-home
 * - https://example.com/blog/post → example-com-blog-post
 * - https://app.site.com/login → app-site-com-login
 */
export function urlToSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Get domain and replace dots with dashes
    const domain = urlObj.hostname.replace(/\./g, '-');
    
    // Get path and convert to slug
    let path = urlObj.pathname;
    
    // Root path becomes "home"
    if (path === '/' || path === '') {
      path = 'home';
    } else {
      // Remove leading/trailing slashes and replace remaining slashes with dashes
      path = path.replace(/^\/|\/$/g, '').replace(/\//g, '-');
    }
    
    return `${domain}-${path}`;
  } catch (error) {
    // Fallback for invalid URLs
    return url.replace(/[^a-zA-Z0-9]/g, '-');
  }
}

/**
 * Merge default config with page-specific config
 */
export function mergeConfig(defaultConfig: PageConfig, pageConfig: Partial<PageConfig>): PageConfig {
  return {
    ...defaultConfig,
    ...pageConfig,
  };
}

/**
 * Format duration in seconds with 1 decimal place
 */
export function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(1);
}

/**
 * Convert device name to slug for filename
 * Examples:
 * - 'desktop' → 'desktop'
 * - 'mobile' → 'mobile'
 * - 'iPhone 13' → 'iphone-13'
 * - 'iPad Pro' → 'ipad-pro'
 */
export function deviceToSlug(device: DeviceName): string {
  return device.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Expand pages with multiple devices into individual jobs
 * Example: 3 URLs with 3 devices each = 9 jobs
 */
export function expandPageJobs(config: Config): PageJob[] {
  const jobs: PageJob[] = [];
  
  for (const [url, pageConfig] of Object.entries(config.pages)) {
    const mergedConfig = mergeConfig(config._default, pageConfig || {});
    
    // Create a job for each device
    for (const device of mergedConfig.devices) {
      jobs.push({
        url,
        device,
        config: mergedConfig,
      });
    }
  }
  
  return jobs;
}

/**
 * Find all screenshot files matching URL+device pattern
 * Pattern: {urlSlug}.{deviceSlug}.png or {urlSlug}.{deviceSlug}.part1of2.png
 */
export function findScreenshots(
  directory: string,
  urlSlug: string,
  deviceSlug: string
): string[] {
  const fs = require('fs');
  if (!fs.existsSync(directory)) {
    return [];
  }
  
  const files = fs.readdirSync(directory);
  // Match files with dots as separators: urlSlug.deviceSlug.png or urlSlug.deviceSlug.part1of2.png
  const pattern = new RegExp(`^${urlSlug}\\.${deviceSlug}(\\.part\\d+of\\d+)?\\.png$`);
  return files.filter((f: string) => pattern.test(f)).sort();
}

/**
 * Truncate URL from front for display
 * Example: https://example.com/very/long/path -> ...com/very/long/path
 */
export function truncateUrl(url: string, maxLength: number = 30): string {
  if (url.length <= maxLength) return url;
  return '...' + url.slice(-(maxLength - 3));
}

/**
 * Prompt user for yes/no input
 */
export async function promptUser(question: string): Promise<boolean> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
