import type { Zone, TrackingResult, ZoneAnalytics, Point } from '../types';

/**
 * Check if a point is inside a zone
 */
export function isPointInZone(point: Point, zone: Zone): boolean {
  if (zone.shape === 'rectangle') {
    return (
      point.x >= zone.x &&
      point.x <= zone.x + zone.width &&
      point.y >= zone.y &&
      point.y <= zone.y + zone.height
    );
  } else if (zone.shape === 'circle') {
    const centerX = zone.x;
    const centerY = zone.y;
    const radius = zone.width / 2;
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= radius;
  }
  return false;
}

/**
 * Analyze zone metrics from tracking results
 */
export function analyzeZones(
  zones: Zone[],
  trackingResults: TrackingResult[],
  fps: number
): ZoneAnalytics[] {
  const analytics: ZoneAnalytics[] = [];

  for (const zone of zones) {
    let timeInZone = 0;
    let entryCount = 0;
    let exitCount = 0;
    let firstEntry: number | null = null;
    let lastExit: number | null = null;
    let wasInZonePreviously = false;

    for (let i = 0; i < trackingResults.length; i++) {
      const result = trackingResults[i];
      const { centerOfMass, timestamp } = result;

      if (!centerOfMass) {
        // No detection in this frame
        if (wasInZonePreviously) {
          exitCount++;
          lastExit = timestamp;
          wasInZonePreviously = false;
        }
        continue;
      }

      const isInZone = isPointInZone(centerOfMass, zone);

      if (isInZone) {
        // Currently in zone
        timeInZone += 1 / fps; // Add one frame duration

        if (!wasInZonePreviously) {
          // Just entered zone
          entryCount++;
          if (firstEntry === null) {
            firstEntry = timestamp;
          }
        }
        wasInZonePreviously = true;
      } else {
        // Currently outside zone
        if (wasInZonePreviously) {
          // Just exited zone
          exitCount++;
          lastExit = timestamp;
        }
        wasInZonePreviously = false;
      }
    }

    analytics.push({
      zoneId: zone.id,
      zoneName: zone.name,
      timeInZone,
      entryCount,
      exitCount,
      firstEntry,
      lastExit,
    });
  }

  return analytics;
}

/**
 * Get the zone that a point is currently in (returns first match)
 */
export function getZoneAtPoint(point: Point, zones: Zone[]): Zone | null {
  for (const zone of zones) {
    if (isPointInZone(point, zone)) {
      return zone;
    }
  }
  return null;
}
