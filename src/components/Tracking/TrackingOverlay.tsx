import { useEffect, useRef } from 'react';
import { useTrackingStore } from '../../stores/trackingSlice';
import { useVideoStore } from '../../stores/trackingStore';

interface TrackingOverlayProps {
  width: number;
  height: number;
}

export function TrackingOverlay({ width, height }: TrackingOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const results = useTrackingStore((state) => state.results);
  const currentTime = useVideoStore((state) => state.playback.currentTime);
  const metadata = useVideoStore((state) => state.metadata);
  const hasData = useTrackingStore((state) => state.hasTrackingData());

  useEffect(() => {
    const overlay = overlayRef.current;

    if (!overlay || !hasData || !metadata) return;

    const ctx = overlay.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Clear overlay
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Calculate which frame to show based on current time
    const currentFrameIndex = Math.floor(currentTime * metadata.fps);
    const currentResult = results.find((r) => r.frameNumber === currentFrameIndex);

    // Draw trajectory line (all previous points)
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    let hasStarted = false;
    for (let i = 0; i <= results.length; i++) {
      const result = results[i];
      if (result?.frameNumber > currentFrameIndex) break;

      if (result?.centerOfMass) {
        const x = result.centerOfMass.x;
        const y = result.centerOfMass.y;

        if (!hasStarted) {
          ctx.moveTo(x, y);
          hasStarted = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();

    // Draw current position as red dot
    if (currentResult?.centerOfMass) {
      const { x, y } = currentResult.centerOfMass;

      // Outer glow
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();

      // Main dot
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Center point
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw coordinates
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      const text = `(${Math.round(x)}, ${Math.round(y)})`;
      ctx.strokeText(text, x + 10, y - 10);
      ctx.fillText(text, x + 10, y - 10);
    }
  }, [results, currentTime, metadata, hasData]);

  if (!hasData) return null;

  return (
    <canvas
      ref={overlayRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}
