import type { Zone } from '../types';
import { getZoneAtPoint } from './zoneAnalysis';
import { pixelsToCm } from './calibration';

/**
 * Export tracking data to CSV format and trigger download
 */
export function exportTrackingDataToCSV(
  data: Array<{
    frameNumber: number;
    timestamp: number;
    centerOfMass: { x: number; y: number } | null;
    pixelCount: number;
    brightnessAverage: number;
    distanceFromPrevious: number;
    speed: number;
    // AI-specific fields (optional)
    aiBBox?: { x: number; y: number; width: number; height: number };
    aiClass?: string;
    aiScore?: number;
  }>,
  zones: Zone[] = [],
  pixelsPerCm: number | null = null
) {
  // Check if AI tracking data is present
  const hasAiData = data.length > 0 && 'aiClass' in data[0];

  // CSV headers
  const headers = [
    'Frame Number',
    'Timestamp (s)',
    'X Position (px)',
    'Y Position (px)',
    'Pixel Count',
    'Brightness Average',
    'Distance from Previous (px)',
    'Speed (px/s)',
    'Current Zone',
  ];

  // Add AI columns if present
  if (hasAiData) {
    headers.push(
      'AI Class',
      'AI Score',
      'BBox X (px)',
      'BBox Y (px)',
      'BBox Width (px)',
      'BBox Height (px)'
    );
  }

  // Add cm columns if calibrated
  if (pixelsPerCm && pixelsPerCm > 0) {
    headers.push('X Position (cm)', 'Y Position (cm)', 'Distance from Previous (cm)', 'Speed (cm/s)');
  }

  // Convert data to CSV rows
  const rows = data.map((item) => {
    // Determine which zone the point is in
    let zoneName = 'None';
    if (item.centerOfMass && zones.length > 0) {
      const zone = getZoneAtPoint(
        { x: item.centerOfMass.x, y: item.centerOfMass.y, timestamp: item.timestamp },
        zones
      );
      if (zone) {
        zoneName = zone.name;
      }
    }

    const row = [
      item.frameNumber,
      item.timestamp.toFixed(3),
      item.centerOfMass ? item.centerOfMass.x.toFixed(2) : 'N/A',
      item.centerOfMass ? item.centerOfMass.y.toFixed(2) : 'N/A',
      item.pixelCount,
      item.brightnessAverage.toFixed(2),
      item.distanceFromPrevious.toFixed(2),
      item.speed.toFixed(2),
      zoneName,
    ];

    // Add AI columns if present
    if (hasAiData) {
      row.push(
        item.aiClass || 'N/A',
        item.aiScore !== undefined ? item.aiScore.toFixed(3) : 'N/A',
        item.aiBBox ? item.aiBBox.x.toFixed(2) : 'N/A',
        item.aiBBox ? item.aiBBox.y.toFixed(2) : 'N/A',
        item.aiBBox ? item.aiBBox.width.toFixed(2) : 'N/A',
        item.aiBBox ? item.aiBBox.height.toFixed(2) : 'N/A'
      );
    }

    // Add cm columns if calibrated
    if (pixelsPerCm && pixelsPerCm > 0) {
      row.push(
        item.centerOfMass ? pixelsToCm(item.centerOfMass.x, pixelsPerCm).toFixed(2) : 'N/A',
        item.centerOfMass ? pixelsToCm(item.centerOfMass.y, pixelsPerCm).toFixed(2) : 'N/A',
        pixelsToCm(item.distanceFromPrevious, pixelsPerCm).toFixed(2),
        pixelsToCm(item.speed, pixelsPerCm).toFixed(2)
      );
    }

    return row;
  });

  // Combine headers and rows
  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `tracking_data_${Date.now()}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
