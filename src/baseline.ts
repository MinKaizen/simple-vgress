// Baseline management module
// Handles baseline symlink creation, validation, and screenshot discovery

import * as fs from 'fs';
import * as path from 'path';

export interface BaselineInfo {
  exists: boolean;
  path: string | null;
  isEmpty: boolean;
}

/**
 * Check if baseline exists and is valid
 */
export function checkBaseline(): BaselineInfo {
  const baselinePath = path.join(process.cwd(), 'output', 'baseline');
  
  // Check if baseline exists
  if (!fs.existsSync(baselinePath)) {
    return {
      exists: false,
      path: null,
      isEmpty: true,
    };
  }
  
  // Check if it's a symlink or regular directory
  const stats = fs.lstatSync(baselinePath);
  
  if (stats.isSymbolicLink()) {
    // Resolve symlink
    try {
      const targetPath = fs.readlinkSync(baselinePath);
      const absoluteTargetPath = path.isAbsolute(targetPath)
        ? targetPath
        : path.join(path.dirname(baselinePath), targetPath);
      
      // Check if target exists
      if (!fs.existsSync(absoluteTargetPath)) {
        console.warn('⚠️  Baseline symlink is broken (target deleted). Treating as missing.');
        return {
          exists: false,
          path: null,
          isEmpty: true,
        };
      }
      
      // Check if target has screenshots
      const screenshots = getBaselineScreenshots(absoluteTargetPath);
      
      return {
        exists: true,
        path: absoluteTargetPath,
        isEmpty: screenshots.length === 0,
      };
    } catch (error) {
      console.warn('⚠️  Failed to resolve baseline symlink. Treating as missing.');
      return {
        exists: false,
        path: null,
        isEmpty: true,
      };
    }
  } else if (stats.isDirectory()) {
    // Regular directory (legacy behavior)
    console.warn('⚠️  Baseline is a regular directory (expected symlink). Using it anyway.');
    const screenshots = getBaselineScreenshots(baselinePath);
    
    return {
      exists: true,
      path: baselinePath,
      isEmpty: screenshots.length === 0,
    };
  }
  
  return {
    exists: false,
    path: null,
    isEmpty: true,
  };
}

/**
 * Create baseline symlink pointing to a timestamped folder
 */
export function createBaselineSymlink(timestampFolder: string): void {
  const baselinePath = path.join(process.cwd(), 'output', 'baseline');
  const targetPath = path.join(process.cwd(), 'output', timestampFolder);
  
  // Ensure target exists
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target folder does not exist: ${targetPath}`);
  }
  
  // Remove existing baseline if it exists
  if (fs.existsSync(baselinePath)) {
    const stats = fs.lstatSync(baselinePath);
    if (stats.isSymbolicLink()) {
      fs.unlinkSync(baselinePath);
    } else if (stats.isDirectory()) {
      console.warn('⚠️  Removing existing baseline directory to create symlink');
      fs.rmSync(baselinePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(baselinePath);
    }
  }
  
  // Create symlink (relative path for portability)
  fs.symlinkSync(timestampFolder, baselinePath, 'dir');
}

/**
 * Update baseline symlink to point to a new timestamped folder
 */
export function updateBaselineSymlink(newTimestampFolder: string): void {
  createBaselineSymlink(newTimestampFolder);
}

/**
 * Get list of all screenshot files in baseline
 */
export function getBaselineScreenshots(baselinePath?: string): string[] {
  const basePath = baselinePath || path.join(process.cwd(), 'output', 'baseline');
  
  if (!fs.existsSync(basePath)) {
    return [];
  }
  
  try {
    const files = fs.readdirSync(basePath);
    // Only return .png files, exclude diffs subdirectory
    return files.filter(f => f.endsWith('.png') && !f.includes('/'));
  } catch (error) {
    console.warn(`⚠️  Failed to read baseline directory: ${error}`);
    return [];
  }
}

/**
 * Validate that baseline symlink is not broken
 */
export function isValidBaseline(): boolean {
  const info = checkBaseline();
  return info.exists && !info.isEmpty;
}
