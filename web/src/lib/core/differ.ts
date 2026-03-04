// Visual comparison module
// Handles image comparison, diff generation, and diff mask creation

import sharp from 'sharp';
import pixelmatch from 'pixelmatch';

export interface ComparisonResult {
  diffPercentage: number;
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
}

/**
 * Compare two images pixel-by-pixel and return difference percentage
 */
export async function compareImages(
  baselinePath: string,
  currentPath: string
): Promise<ComparisonResult> {
  try {
    const [baselineBuffer, baselineInfo] = await loadAndNormalizeImage(baselinePath);
    const [currentBuffer, currentInfo] = await loadAndNormalizeImage(currentPath);
    
    let finalBaselineBuffer = baselineBuffer;
    let finalCurrentBuffer = currentBuffer;
    let width = baselineInfo.width;
    let height = baselineInfo.height;
    
    if (baselineInfo.width !== currentInfo.width || baselineInfo.height !== currentInfo.height) {
      const maxWidth = Math.max(baselineInfo.width, currentInfo.width);
      const maxHeight = Math.max(baselineInfo.height, currentInfo.height);
      
      finalBaselineBuffer = await padImageWithBlack(
        baselineBuffer,
        baselineInfo.width,
        baselineInfo.height,
        maxWidth,
        maxHeight
      );
      
      finalCurrentBuffer = await padImageWithBlack(
        currentBuffer,
        currentInfo.width,
        currentInfo.height,
        maxWidth,
        maxHeight
      );
      
      width = maxWidth;
      height = maxHeight;
    }
    
    const diffBuffer = Buffer.alloc(width * height * 4);
    const diffPixels = pixelmatch(
      finalBaselineBuffer,
      finalCurrentBuffer,
      diffBuffer,
      width,
      height,
      { threshold: 0.1 }
    );
    
    const totalPixels = width * height;
    const diffPercentage = (diffPixels / totalPixels) * 100;
    
    return {
      diffPercentage,
      width,
      height,
      diffPixels,
      totalPixels,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Input buffer') || error.message.includes('corrupt')) {
        throw new Error(`corrupted: ${error.message}`);
      }
    }
    throw error;
  }
}

/**
 * Create side-by-side diff image
 */
export async function createSideBySideDiff(
  baselinePath: string,
  currentPath: string,
  outputPath: string
): Promise<void> {
  const [baselineBuffer, baselineInfo] = await loadAndNormalizeImage(baselinePath);
  const [currentBuffer, currentInfo] = await loadAndNormalizeImage(currentPath);
  
  const maxWidth = Math.max(baselineInfo.width, currentInfo.width);
  const maxHeight = Math.max(baselineInfo.height, currentInfo.height);
  
  const paddedBaseline = await padImageWithBlack(
    baselineBuffer,
    baselineInfo.width,
    baselineInfo.height,
    maxWidth,
    maxHeight
  );
  
  const paddedCurrent = await padImageWithBlack(
    currentBuffer,
    currentInfo.width,
    currentInfo.height,
    maxWidth,
    maxHeight
  );
  
  const separatorWidth = 6;
  const separatorBuffer = Buffer.alloc(separatorWidth * maxHeight * 4);
  
  for (let y = 0; y < maxHeight; y++) {
    for (let x = 0; x < separatorWidth; x++) {
      const idx = (y * separatorWidth + x) * 4;
      if (x < 3) {
        separatorBuffer[idx] = 0;
        separatorBuffer[idx + 1] = 255;
        separatorBuffer[idx + 2] = 0;
        separatorBuffer[idx + 3] = 255;
      } else {
        separatorBuffer[idx] = 255;
        separatorBuffer[idx + 1] = 0;
        separatorBuffer[idx + 2] = 0;
        separatorBuffer[idx + 3] = 255;
      }
    }
  }
  
  const baselineImageBuffer = await sharp(paddedBaseline, {
    raw: { width: maxWidth, height: maxHeight, channels: 4 }
  }).png().toBuffer();
  
  const separatorImageBuffer = await sharp(separatorBuffer, {
    raw: { width: separatorWidth, height: maxHeight, channels: 4 }
  }).png().toBuffer();
  
  const currentImageBuffer = await sharp(paddedCurrent, {
    raw: { width: maxWidth, height: maxHeight, channels: 4 }
  }).png().toBuffer();
  
  const totalWidth = maxWidth * 2 + separatorWidth;
  
  await sharp({
    create: {
      width: totalWidth,
      height: maxHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    }
  })
    .composite([
      { input: baselineImageBuffer, left: 0, top: 0 },
      { input: separatorImageBuffer, left: maxWidth, top: 0 },
      { input: currentImageBuffer, left: maxWidth + separatorWidth, top: 0 }
    ])
    .png()
    .toFile(outputPath);
}

/**
 * Create traditional diff mask
 */
export async function createDiffMask(
  baselinePath: string,
  currentPath: string,
  outputPath: string
): Promise<void> {
  const [baselineBuffer, baselineInfo] = await loadAndNormalizeImage(baselinePath);
  const [currentBuffer, currentInfo] = await loadAndNormalizeImage(currentPath);
  
  let finalBaselineBuffer = baselineBuffer;
  let finalCurrentBuffer = currentBuffer;
  let width = baselineInfo.width;
  let height = baselineInfo.height;
  
  if (baselineInfo.width !== currentInfo.width || baselineInfo.height !== currentInfo.height) {
    const maxWidth = Math.max(baselineInfo.width, currentInfo.width);
    const maxHeight = Math.max(baselineInfo.height, currentInfo.height);
    
    finalBaselineBuffer = await padImageWithBlack(
      baselineBuffer,
      baselineInfo.width,
      baselineInfo.height,
      maxWidth,
      maxHeight
    );
    
    finalCurrentBuffer = await padImageWithBlack(
      currentBuffer,
      currentInfo.width,
      currentInfo.height,
      maxWidth,
      maxHeight
    );
    
    width = maxWidth;
    height = maxHeight;
  }
  
  const diffBuffer = Buffer.alloc(width * height * 4);
  
  pixelmatch(
    finalBaselineBuffer,
    finalCurrentBuffer,
    diffBuffer,
    width,
    height,
    { threshold: 0.1, diffColor: [255, 0, 0] }
  );
  
  await sharp(diffBuffer, {
    raw: { width, height, channels: 4 }
  })
    .png()
    .toFile(outputPath);
}

/**
 * Load image and normalize to sRGB
 */
async function loadAndNormalizeImage(imagePath: string): Promise<[Buffer, { width: number; height: number }]> {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    const buffer = await image
      .toColorspace('srgb')
      .ensureAlpha()
      .raw()
      .toBuffer();
    
    return [buffer, { width: metadata.width!, height: metadata.height! }];
  } catch (error) {
    throw new Error(`Failed to load image ${imagePath}: ${error}`);
  }
}

/**
 * Pad image buffer with black
 */
async function padImageWithBlack(
  buffer: Buffer,
  currentWidth: number,
  currentHeight: number,
  targetWidth: number,
  targetHeight: number
): Promise<Buffer> {
  if (currentWidth === targetWidth && currentHeight === targetHeight) {
    return buffer;
  }
  
  const paddedBuffer = Buffer.alloc(targetWidth * targetHeight * 4);
  paddedBuffer.fill(0);
  
  for (let i = 3; i < paddedBuffer.length; i += 4) {
    paddedBuffer[i] = 255;
  }
  
  for (let y = 0; y < currentHeight; y++) {
    for (let x = 0; x < currentWidth; x++) {
      const srcIdx = (y * currentWidth + x) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      
      paddedBuffer[dstIdx] = buffer[srcIdx];
      paddedBuffer[dstIdx + 1] = buffer[srcIdx + 1];
      paddedBuffer[dstIdx + 2] = buffer[srcIdx + 2];
      paddedBuffer[dstIdx + 3] = buffer[srcIdx + 3];
    }
  }
  
  return paddedBuffer;
}
