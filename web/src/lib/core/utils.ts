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
  waitFor: string[];
  scrollPage: boolean;
  maxScreenshotHeight: number | null;
  visualRegressionThreshold: number;
  generateDiffMask: boolean;
  additionalWaitMs: number;
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

export const DEFAULT_CONFIG: PageConfig = {
  fullPage: true,
  devices: ['desktop', 'mobile', 'tablet'],
  timeoutMs: 30000,
  requiredSelectors: [],
  abortIfFail: false,
  waitUntil: 'load',
  waitFor: [],
  scrollPage: true,
  additionalWaitMs: 5000,
  maxScreenshotHeight: 7000,
  visualRegressionThreshold: 1.0,
  generateDiffMask: true,
};

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
 */
export function urlToSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/\./g, '-');
    let path = urlObj.pathname;
    
    if (path === '/' || path === '') {
      path = 'home';
    } else {
      path = path.replace(/^\/|\/$/g, '').replace(/\//g, '-');
    }
    
    return `${domain}-${path}`;
  } catch {
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
 */
export function deviceToSlug(device: DeviceName): string {
  return device.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Expand pages with multiple devices into individual jobs
 */
export function expandPageJobs(config: Config): PageJob[] {
  const jobs: PageJob[] = [];
  
  for (const [url, pageConfig] of Object.entries(config.pages)) {
    const mergedConfig = mergeConfig(config._default, pageConfig || {});
    
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
  const pattern = new RegExp(`^${urlSlug}\\.${deviceSlug}(\\.part\\d+of\\d+)?\\.png$`);
  return files.filter((f: string) => pattern.test(f)).sort();
}

/**
 * Truncate URL from front for display
 */
export function truncateUrl(url: string, maxLength: number = 30): string {
  if (url.length <= maxLength) return url;
  return '...' + url.slice(-(maxLength - 3));
}

/**
 * Parse YAML config string to Config object
 */
export function parseConfig(yamlString: string): Config {
  const yaml = require('yaml');
  const parsed = yaml.parse(yamlString);
  
  // Ensure _default exists
  if (!parsed._default) {
    parsed._default = DEFAULT_CONFIG;
  } else {
    // Merge with defaults for missing properties
    parsed._default = { ...DEFAULT_CONFIG, ...parsed._default };
  }
  
  // Ensure pages exists
  if (!parsed.pages) {
    parsed.pages = {};
  }
  
  return parsed as Config;
}

/**
 * Stringify Config object to YAML
 */
export function stringifyConfig(config: Config): string {
  const yaml = require('yaml');
  return yaml.stringify(config);
}

/**
 * Validate config structure
 */
export function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }
  
  const c = config as Record<string, unknown>;
  
  if (c.pages && typeof c.pages === 'object') {
    for (const [url, pageConfig] of Object.entries(c.pages)) {
      try {
        new URL(url);
      } catch {
        errors.push(`Invalid URL: ${url}`);
      }
      
      if (pageConfig && typeof pageConfig === 'object') {
        const pc = pageConfig as Record<string, unknown>;
        
        if (pc.devices && !Array.isArray(pc.devices)) {
          errors.push(`devices must be an array for ${url}`);
        }
        if (pc.timeoutMs && typeof pc.timeoutMs !== 'number') {
          errors.push(`timeoutMs must be a number for ${url}`);
        }
        if (pc.requiredSelectors && !Array.isArray(pc.requiredSelectors)) {
          errors.push(`requiredSelectors must be an array for ${url}`);
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}
