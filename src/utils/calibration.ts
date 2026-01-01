import type { Point } from '../types';

/**
 * Calculate Euclidean distance between two points in pixels
 */
export function calculatePixelDistance(start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate pixels per centimeter scale factor
 */
export function calculatePixelsPerCm(pixelDistance: number, realCm: number): number {
  if (realCm <= 0) {
    throw new Error('Real distance must be greater than 0');
  }
  return pixelDistance / realCm;
}

/**
 * Convert pixels to centimeters using calibration
 */
export function pixelsToCm(pixels: number, pixelsPerCm: number | null): number {
  if (!pixelsPerCm || pixelsPerCm <= 0) {
    return pixels; // Return pixels if not calibrated
  }
  return pixels / pixelsPerCm;
}

/**
 * Convert centimeters to pixels using calibration
 */
export function cmToPixels(cm: number, pixelsPerCm: number | null): number {
  if (!pixelsPerCm || pixelsPerCm <= 0) {
    return cm; // Return as-is if not calibrated
  }
  return cm * pixelsPerCm;
}

/**
 * Calculate area in cm² from pixel area
 */
export function pixelAreaToCm2(pixelArea: number, pixelsPerCm: number | null): number {
  if (!pixelsPerCm || pixelsPerCm <= 0) {
    return pixelArea;
  }
  // Area scales with square of linear scale
  return pixelArea / (pixelsPerCm * pixelsPerCm);
}

/**
 * Format distance with appropriate unit
 */
export function formatDistance(
  pixels: number,
  pixelsPerCm: number | null,
  showUnit: boolean = true
): string {
  if (pixelsPerCm && pixelsPerCm > 0) {
    const cm = pixelsToCm(pixels, pixelsPerCm);
    return showUnit ? `${cm.toFixed(2)} cm` : cm.toFixed(2);
  }
  return showUnit ? `${pixels.toFixed(2)} px` : pixels.toFixed(2);
}

/**
 * Format speed with appropriate unit
 */
export function formatSpeed(
  pixelsPerSecond: number,
  pixelsPerCm: number | null,
  showUnit: boolean = true
): string {
  if (pixelsPerCm && pixelsPerCm > 0) {
    const cmPerSecond = pixelsToCm(pixelsPerSecond, pixelsPerCm);
    return showUnit ? `${cmPerSecond.toFixed(2)} cm/s` : cmPerSecond.toFixed(2);
  }
  return showUnit ? `${pixelsPerSecond.toFixed(2)} px/s` : pixelsPerSecond.toFixed(2);
}

/**
 * Format area with appropriate unit
 */
export function formatArea(
  pixelArea: number,
  pixelsPerCm: number | null,
  showUnit: boolean = true
): string {
  if (pixelsPerCm && pixelsPerCm > 0) {
    const cm2 = pixelAreaToCm2(pixelArea, pixelsPerCm);
    return showUnit ? `${cm2.toFixed(2)} cm²` : cm2.toFixed(2);
  }
  return showUnit ? `${pixelArea.toFixed(0)} px²` : pixelArea.toFixed(0);
}
