import { useEffect, useRef } from 'react';
import { useTrackingStore } from '../../stores/trackingSlice';
import { useVideoStore } from '../../stores/trackingStore';
import { hitTestBBox } from '../../utils/aiDetection';

interface DebugOverlayProps {
  width: number;
  height: number;
}

export function DebugOverlay({ width, height }: DebugOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const latestDetections = useTrackingStore((state) => state.latestDetections);
  const lastAiBox = useTrackingStore((state) => state.lastAiBox);
  const lastAiBoxSource = useTrackingStore((state) => state.lastAiBoxSource);
  const setLastAiBox = useTrackingStore((state) => state.setLastAiBox);
  const aiTargetClass = useTrackingStore((state) => state.config.aiTargetClass);
  const updateConfig = useTrackingStore((state) => state.updateConfig);
  const currentTime = useVideoStore((state) => state.playback.currentTime);

  /**
   * Handle click on overlay to lock an instance
   */
  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current;
    if (!canvas) return;

    const clientX = event.clientX;
    const clientY = event.clientY;

    // Find clicked detection (prioritize target class)
    const targetDetections = latestDetections.filter((d) => d.class === aiTargetClass);

    for (const detection of targetDetections) {
      if (hitTestBBox(clientX, clientY, detection.bbox, canvas)) {
        // Lock this instance AND set class
        setLastAiBox(detection.bbox, 'user');
        updateConfig({ aiTargetClass: detection.class });
        console.log(`Locked instance: ${detection.class} (score: ${detection.score.toFixed(2)})`);
        return;
      }
    }

    // If no target class hit, check all detections
    for (const detection of latestDetections) {
      if (hitTestBBox(clientX, clientY, detection.bbox, canvas)) {
        // Lock this instance AND set class
        setLastAiBox(detection.bbox, 'user');
        updateConfig({ aiTargetClass: detection.class });
        console.log(`Locked instance: ${detection.class} (score: ${detection.score.toFixed(2)})`);
        return;
      }
    }
  };

  /**
   * Draw debug overlay
   */
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Clear overlay
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw all detections
    latestDetections.forEach((detection) => {
      const isTargetClass = detection.class === aiTargetClass;
      const isLocked =
        lastAiBoxSource === 'user' &&
        lastAiBox &&
        lastAiBox.x === detection.bbox.x &&
        lastAiBox.y === detection.bbox.y;

      // Box color
      if (isLocked) {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)'; // Gold for locked
        ctx.lineWidth = 3;
      } else if (isTargetClass) {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)'; // Green for target class
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // Red for other classes
        ctx.lineWidth = 1;
      }

      // Draw box
      const { x, y, width, height } = detection.bbox;
      ctx.strokeRect(x, y, width, height);

      // Draw label background
      const label = `${detection.class} ${(detection.score * 100).toFixed(0)}%`;
      ctx.font = '11px monospace';
      const textWidth = ctx.measureText(label).width;
      const padding = 2;

      ctx.fillStyle = isLocked
        ? 'rgba(255, 215, 0, 0.9)'
        : isTargetClass
        ? 'rgba(0, 255, 0, 0.8)'
        : 'rgba(255, 0, 0, 0.7)';
      ctx.fillRect(x, y - 14, textWidth + padding * 2, 14);

      // Draw label text
      ctx.fillStyle = 'white';
      ctx.fillText(label, x + padding, y - 3);

      // Draw lock icon if locked
      if (isLocked) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
        ctx.font = '10px monospace';
        ctx.fillText('🔒', x + width - 15, y + 12);
      }
    });

    // Draw selected box (if different from detections - lost frame case)
    if (lastAiBox && lastAiBoxSource === 'user') {
      const matchesDetection = latestDetections.some(
        (d) => d.bbox.x === lastAiBox.x && d.bbox.y === lastAiBox.y
      );

      if (!matchesDetection) {
        // Draw last known position (lost frame)
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)'; // Orange for lost
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(lastAiBox.x, lastAiBox.y, lastAiBox.width, lastAiBox.height);
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
        ctx.fillRect(lastAiBox.x, lastAiBox.y - 14, 45, 14);
        ctx.fillStyle = 'white';
        ctx.font = '11px monospace';
        ctx.fillText('LOST', lastAiBox.x + 2, lastAiBox.y - 3);
      }
    }
  }, [latestDetections, lastAiBox, lastAiBoxSource, aiTargetClass, currentTime]);

  return (
    <canvas
      ref={overlayRef}
      width={width}
      height={height}
      onClick={handleClick}
      className="absolute top-0 left-0 cursor-pointer"
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}
