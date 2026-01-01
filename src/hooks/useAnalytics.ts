import { useMemo } from 'react';
import { useTrackingStore } from '../stores/trackingSlice';
import type { TrackingMetrics } from '../types';

/**
 * Calculate distance between two points
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate detailed analytics from tracking results
 */
export function useAnalytics() {
  const results = useTrackingStore((state) => state.results);

  const metrics = useMemo((): TrackingMetrics => {
    if (results.length === 0) {
      return {
        totalDistance: 0,
        totalDistanceScaled: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        minSpeed: 0,
        totalFramesTracked: 0,
        successfulDetections: 0,
        failedDetections: 0,
      };
    }

    const successfulDetections = results.filter((r) => r.centerOfMass !== null).length;
    const failedDetections = results.length - successfulDetections;

    let totalDistance = 0;
    const speeds: number[] = [];

    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];

      if (prev.centerOfMass && curr.centerOfMass) {
        const distance = calculateDistance(
          prev.centerOfMass.x,
          prev.centerOfMass.y,
          curr.centerOfMass.x,
          curr.centerOfMass.y
        );

        totalDistance += distance;

        const timeDiff = curr.timestamp - prev.timestamp;
        if (timeDiff > 0) {
          const speed = distance / timeDiff; // pixels per second
          speeds.push(speed);
        }
      }
    }

    return {
      totalDistance,
      totalDistanceScaled: totalDistance, // TODO: Apply scaling factor
      averageSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
      minSpeed:
        speeds.length > 0 && speeds.length === successfulDetections - 1
          ? Math.min(...speeds)
          : 0,
      totalFramesTracked: results.length,
      successfulDetections,
      failedDetections,
    };
  }, [results]);

  /**
   * Get tracking data with calculated distances and speeds
   */
  const detailedData = useMemo(() => {
    return results.map((result, index) => {
      let distanceFromPrevious = 0;
      let speed = 0;

      if (index > 0 && result.centerOfMass && results[index - 1].centerOfMass) {
        const prev = results[index - 1];
        distanceFromPrevious = calculateDistance(
          prev.centerOfMass!.x,
          prev.centerOfMass!.y,
          result.centerOfMass.x,
          result.centerOfMass.y
        );

        const timeDiff = result.timestamp - prev.timestamp;
        if (timeDiff > 0) {
          speed = distanceFromPrevious / timeDiff;
        }
      }

      return {
        ...result,
        distanceFromPrevious,
        speed,
      };
    });
  }, [results]);

  return {
    metrics,
    detailedData,
  };
}
