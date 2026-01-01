import type { BBox, AiTrackStrategy } from '../types';

/**
 * Calculate Intersection over Union (IoU) between two bounding boxes
 */
export function calculateIoU(box1: BBox, box2: BBox): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0;
}

/**
 * Calculate Euclidean distance between centers of two bounding boxes
 */
export function bboxDistance(box1: BBox, box2: BBox): number {
  const center1X = box1.x + box1.width / 2;
  const center1Y = box1.y + box1.height / 2;
  const center2X = box2.x + box2.width / 2;
  const center2Y = box2.y + box2.height / 2;

  const dx = center2X - center1X;
  const dy = center2Y - center1Y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate bounding box area
 */
export function bboxArea(box: BBox): number {
  return box.width * box.height;
}

/**
 * Get center point of bounding box
 */
export function bboxCenter(box: BBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/**
 * Convert COCO-SSD detection format to BBox
 */
export function cocoDetectionToBBox(detection: {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}): { bbox: BBox; class: string; score: number } {
  return {
    bbox: {
      x: detection.bbox[0],
      y: detection.bbox[1],
      width: detection.bbox[2],
      height: detection.bbox[3],
    },
    class: detection.class,
    score: detection.score,
  };
}

/**
 * Select best detection from candidates based on strategy
 */
export function selectBestDetection(
  detections: Array<{ bbox: BBox; score: number }>,
  strategy: AiTrackStrategy,
  previousBox: BBox | null
): { bbox: BBox; score: number } | null {
  if (detections.length === 0) return null;

  switch (strategy) {
    case 'highestScore':
      return detections.reduce((best, curr) =>
        curr.score > best.score ? curr : best
      );

    case 'largest':
      return detections.reduce((best, curr) =>
        bboxArea(curr.bbox) > bboxArea(best.bbox) ? curr : best
      );

    case 'nearestPrev':
    default:
      if (!previousBox) {
        // Fallback to highest score if no previous box
        return detections.reduce((best, curr) =>
          curr.score > best.score ? curr : best
        );
      }

      // Find detection with minimum distance to previous box
      return detections.reduce((best, curr) => {
        const currDist = bboxDistance(curr.bbox, previousBox);
        const bestDist = bboxDistance(best.bbox, previousBox);
        return currDist < bestDist ? curr : best;
      });
  }
}

/**
 * Select best detection using user-locked box (max IoU)
 */
export function selectByIoU(
  detections: Array<{ bbox: BBox; score: number }>,
  lockedBox: BBox
): { bbox: BBox; score: number } | null {
  if (detections.length === 0) return null;

  return detections.reduce((best, curr) => {
    const currIoU = calculateIoU(curr.bbox, lockedBox);
    const bestIoU = calculateIoU(best.bbox, lockedBox);
    return currIoU > bestIoU ? curr : best;
  });
}

/**
 * Aggregate unique class names from detection history
 */
export function aggregateDetectedClasses(
  existingClasses: string[],
  newDetections: Array<{ class: string }>
): string[] {
  const classSet = new Set(existingClasses);
  newDetections.forEach((det) => classSet.add(det.class));
  return Array.from(classSet).sort();
}

/**
 * Check if point (client coords) hits a bounding box
 * Requires coordinate transformation from client to video pixel space
 */
export function hitTestBBox(
  clientX: number,
  clientY: number,
  bbox: BBox,
  canvasElement: HTMLCanvasElement
): boolean {
  const rect = canvasElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Transform client coords to canvas pixel coords
  const scaleX = canvasElement.width / rect.width / dpr;
  const scaleY = canvasElement.height / rect.height / dpr;

  const videoX = (clientX - rect.left) * scaleX;
  const videoY = (clientY - rect.top) * scaleY;

  return (
    videoX >= bbox.x &&
    videoX <= bbox.x + bbox.width &&
    videoY >= bbox.y &&
    videoY <= bbox.y + bbox.height
  );
}
