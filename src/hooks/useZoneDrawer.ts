import { useState, type MouseEvent } from 'react';
import { useZoneStore } from '../stores/zoneSlice';

interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface UseZoneDrawerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoWidth: number;
  videoHeight: number;
}

export function useZoneDrawer({ canvasRef, videoWidth, videoHeight }: UseZoneDrawerProps) {
  const drawingMode = useZoneStore((state) => state.drawingMode);
  const addZone = useZoneStore((state) => state.addZone);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const getCanvasCoordinates = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = videoWidth / rect.width;
    const scaleY = videoHeight / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    return { x, y };
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode) return;

    const { x, y } = getCanvasCoordinates(e);
    setDrawingState({
      isDrawing: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!drawingState.isDrawing || !drawingMode) return;

    const { x, y } = getCanvasCoordinates(e);
    setDrawingState((prev) => ({
      ...prev,
      currentX: x,
      currentY: y,
    }));
  };

  const handleMouseUp = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!drawingState.isDrawing || !drawingMode) return;

    const { x, y } = getCanvasCoordinates(e);

    // Create zone based on drawing mode
    if (drawingMode === 'rectangle') {
      const width = Math.abs(x - drawingState.startX);
      const height = Math.abs(y - drawingState.startY);
      const zoneX = Math.min(drawingState.startX, x);
      const zoneY = Math.min(drawingState.startY, y);

      // Only create if zone has minimum size (10x10 pixels)
      if (width >= 10 && height >= 10) {
        addZone({
          name: `Zone ${Date.now()}`,
          shape: 'rectangle',
          color: '#00ff00',
          x: zoneX,
          y: zoneY,
          width,
          height,
        });
      }
    } else if (drawingMode === 'circle') {
      const dx = x - drawingState.startX;
      const dy = y - drawingState.startY;
      const diameter = Math.sqrt(dx * dx + dy * dy) * 2;

      // Only create if circle has minimum diameter (20 pixels)
      if (diameter >= 20) {
        addZone({
          name: `Zone ${Date.now()}`,
          shape: 'circle',
          color: '#00ff00',
          x: drawingState.startX,
          y: drawingState.startY,
          width: diameter,
          height: diameter,
        });
      }
    }

    setDrawingState({
      isDrawing: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });
  };

  const handleMouseLeave = () => {
    // Cancel drawing if mouse leaves canvas
    if (drawingState.isDrawing) {
      setDrawingState({
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      });
    }
  };

  return {
    drawingState,
    isDrawing: drawingState.isDrawing,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
}
