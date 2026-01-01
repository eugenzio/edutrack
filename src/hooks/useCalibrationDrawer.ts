import { useEffect, type MouseEvent } from 'react';
import { useCalibrationStore } from '../stores/calibrationSlice';

interface UseCalibrationDrawerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoWidth: number;
  videoHeight: number;
}

export function useCalibrationDrawer({
  canvasRef,
  videoWidth,
  videoHeight,
}: UseCalibrationDrawerProps) {
  const isDrawingCalibration = useCalibrationStore((state) => state.isDrawingCalibration);
  const drawingStart = useCalibrationStore((state) => state.drawingStart);
  const startDrawing = useCalibrationStore((state) => state.startDrawing);
  const finishDrawing = useCalibrationStore((state) => state.finishDrawing);
  const cancelDrawing = useCalibrationStore((state) => state.cancelDrawing);

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

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingCalibration) return;

    const { x, y } = getCanvasCoordinates(e);
    const point = { x, y, timestamp: Date.now() };

    if (!drawingStart) {
      // First click: set start point
      startDrawing(point);
    } else {
      // Second click: finish line
      finishDrawing(point);
    }
  };

  // ESC key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawingCalibration) {
        cancelDrawing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawingCalibration, cancelDrawing]);

  return {
    handleClick,
    isDrawingCalibration,
    drawingStart,
  };
}
