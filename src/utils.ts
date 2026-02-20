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
