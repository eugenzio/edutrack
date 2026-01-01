import type { TrackingResult } from '../types';

export interface DetectionConfig {
  brightnessThreshold: number;
  minPixelCount: number;
}

/**
 * Calculate brightness of a pixel from RGB values
 * Using simple average: (R + G + B) / 3
 */
export function calculateBrightness(r: number, g: number, b: number): number {
  return (r + g + b) / 3;
}

/**
 * Detect bright pixels and calculate center of mass
 */
export function detectBrightObjects(
  imageData: ImageData,
  config: DetectionConfig
): Omit<TrackingResult, 'frameNumber' | 'timestamp'> {
  const { data, width, height } = imageData;
  const { brightnessThreshold, minPixelCount } = config;

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  let totalBrightness = 0;

  // Iterate through pixels (RGBA format: 4 values per pixel)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      // Alpha channel: data[index + 3] (not needed for brightness)

      const brightness = calculateBrightness(r, g, b);

      if (brightness >= brightnessThreshold) {
        sumX += x;
        sumY += y;
        count++;
        totalBrightness += brightness;
      }
    }
  }

  // Return result with center of mass if enough pixels detected
  if (count >= minPixelCount) {
    return {
      centerOfMass: {
        x: sumX / count,
        y: sumY / count,
        timestamp: 0, // Will be set by caller
      },
      pixelCount: count,
      brightnessAverage: totalBrightness / count,
    };
  }

  // No detection
  return {
    centerOfMass: null,
    pixelCount: count,
    brightnessAverage: count > 0 ? totalBrightness / count : 0,
  };
}
