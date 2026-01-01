import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useCalibrationStore } from '../../stores/calibrationSlice';
import { useCalibrationDrawer } from '../../hooks/useCalibrationDrawer';

interface CalibrationOverlayProps {
  width: number;
  height: number;
}

export function CalibrationOverlay({ width, height }: CalibrationOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const line = useCalibrationStore((state) => state.line);
  const drawingStart = useCalibrationStore((state) => state.drawingStart);
  const isDrawingCalibration = useCalibrationStore((state) => state.isDrawingCalibration);

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const { handleClick } = useCalibrationDrawer({
    canvasRef: overlayRef,
    videoWidth: width,
    videoHeight: height,
  });

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingCalibration || !drawingStart) return;

    const canvas = overlayRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setMousePos({ x, y });
  };

  // Draw calibration line
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Clear overlay
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw existing calibration line
    if (line) {
      drawCalibrationLine(ctx, line.start, line.end, line.realDistanceCm, false);
    }

    // Draw preview line while drawing
    if (isDrawingCalibration && drawingStart && mousePos) {
      drawCalibrationLine(ctx, drawingStart, mousePos, 0, true);
    }
  }, [line, drawingStart, mousePos, isDrawingCalibration]);

  if (!isDrawingCalibration && !line) return null;

  return (
    <canvas
      ref={overlayRef}
      width={width}
      height={height}
      className="absolute top-0 left-0"
      style={{
        width: '100%',
        height: '100%',
        cursor: isDrawingCalibration ? 'crosshair' : 'default',
        pointerEvents: isDrawingCalibration ? 'auto' : 'none',
      }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMousePos(null)}
    />
  );
}

function drawCalibrationLine(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  realCm: number,
  isPreview: boolean
) {
  const alpha = isPreview ? 0.6 : 1.0;

  // Draw dashed line
  ctx.strokeStyle = `rgba(0, 102, 204, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.setLineDash([]);

  // Draw + markers at endpoints
  const markerSize = 8;
  ctx.strokeStyle = `rgba(0, 102, 204, ${alpha})`;
  ctx.lineWidth = 2;

  // Start marker
  ctx.beginPath();
  ctx.moveTo(start.x - markerSize, start.y);
  ctx.lineTo(start.x + markerSize, start.y);
  ctx.moveTo(start.x, start.y - markerSize);
  ctx.lineTo(start.x, start.y + markerSize);
  ctx.stroke();

  // End marker
  ctx.beginPath();
  ctx.moveTo(end.x - markerSize, end.y);
  ctx.lineTo(end.x + markerSize, end.y);
  ctx.moveTo(end.x, end.y - markerSize);
  ctx.lineTo(end.x, end.y + markerSize);
  ctx.stroke();

  // Draw distance label
  if (!isPreview && realCm > 0) {
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    ctx.fillStyle = `rgba(0, 102, 204, ${alpha})`;
    ctx.font = '12px monospace';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;

    const text = `${realCm.toFixed(1)} cm`;
    const textMetrics = ctx.measureText(text);
    const textX = midX - textMetrics.width / 2;
    const textY = midY - 10;

    ctx.strokeText(text, textX, textY);
    ctx.fillText(text, textX, textY);
  }
}
