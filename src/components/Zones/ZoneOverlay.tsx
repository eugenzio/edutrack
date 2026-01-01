import { useEffect, useRef } from 'react';
import { useZoneStore } from '../../stores/zoneSlice';
import { useZoneDrawer } from '../../hooks/useZoneDrawer';
import type { Zone } from '../../types';

interface ZoneOverlayProps {
  width: number;
  height: number;
}

export function ZoneOverlay({ width, height }: ZoneOverlayProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const zones = useZoneStore((state) => state.zones);
  const selectedZoneId = useZoneStore((state) => state.selectedZoneId);
  const drawingMode = useZoneStore((state) => state.drawingMode);

  const { drawingState, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } =
    useZoneDrawer({
      canvasRef: overlayRef,
      videoWidth: width,
      videoHeight: height,
    });

  // Draw zones and current drawing
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Clear overlay
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw existing zones
    zones.forEach((zone) => {
      drawZone(ctx, zone, zone.id === selectedZoneId);
    });

    // Draw current drawing preview
    if (drawingState.isDrawing && drawingMode) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      if (drawingMode === 'rectangle') {
        const width = drawingState.currentX - drawingState.startX;
        const height = drawingState.currentY - drawingState.startY;
        ctx.strokeRect(drawingState.startX, drawingState.startY, width, height);
      } else if (drawingMode === 'circle') {
        const dx = drawingState.currentX - drawingState.startX;
        const dy = drawingState.currentY - drawingState.startY;
        const radius = Math.sqrt(dx * dx + dy * dy);
        ctx.beginPath();
        ctx.arc(drawingState.startX, drawingState.startY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }
  }, [zones, selectedZoneId, drawingState, drawingMode]);

  return (
    <canvas
      ref={overlayRef}
      width={width}
      height={height}
      className="absolute top-0 left-0"
      style={{
        width: '100%',
        height: '100%',
        cursor: drawingMode ? 'crosshair' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}

function drawZone(ctx: CanvasRenderingContext2D, zone: Zone, isSelected: boolean) {
  const strokeColor = isSelected ? '#ffffff' : zone.color;
  const lineWidth = isSelected ? 3 : 2;
  const fillAlpha = isSelected ? 0.2 : 0.1;

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.fillStyle = `${zone.color}${Math.round(fillAlpha * 255).toString(16).padStart(2, '0')}`;

  if (zone.shape === 'rectangle') {
    ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
    ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
  } else if (zone.shape === 'circle') {
    const centerX = zone.x;
    const centerY = zone.y;
    const radius = zone.width / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Draw zone name
  ctx.fillStyle = strokeColor;
  ctx.font = '12px monospace';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;

  const textX = zone.shape === 'rectangle' ? zone.x + 5 : zone.x - 30;
  const textY = zone.shape === 'rectangle' ? zone.y + 15 : zone.y - zone.width / 2 - 5;

  ctx.strokeText(zone.name, textX, textY);
  ctx.fillText(zone.name, textX, textY);
}
