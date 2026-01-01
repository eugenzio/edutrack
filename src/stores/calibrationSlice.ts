import { create } from 'zustand';
import type { CalibrationLine, CalibrationState, Point } from '../types';

interface CalibrationStore extends CalibrationState {
  // Actions
  startDrawing: (point: Point) => void;
  finishDrawing: (point: Point) => void;
  cancelDrawing: () => void;
  setRealDistance: (cm: number) => void;
  clearCalibration: () => void;

  // Computed
  isCalibrated: () => boolean;
  getPixelsPerCm: () => number | null;
}

export const useCalibrationStore = create<CalibrationStore>((set, get) => ({
  line: null,
  pixelsPerCm: null,
  isDrawingCalibration: false,
  drawingStart: null,

  startDrawing: (point) => {
    set({
      isDrawingCalibration: true,
      drawingStart: point,
    });
  },

  finishDrawing: (endPoint) => {
    const { drawingStart } = get();
    if (!drawingStart) return;

    const dx = endPoint.x - drawingStart.x;
    const dy = endPoint.y - drawingStart.y;
    const pixelLength = Math.sqrt(dx * dx + dy * dy);

    // Only create line if it's at least 20 pixels long
    if (pixelLength >= 20) {
      const line: CalibrationLine = {
        start: drawingStart,
        end: endPoint,
        pixelLength,
        realDistanceCm: 10, // Default 10cm
      };

      const pixelsPerCm = pixelLength / line.realDistanceCm;

      set({
        line,
        pixelsPerCm,
        isDrawingCalibration: false,
        drawingStart: null,
      });
    } else {
      // Too short, cancel
      set({
        isDrawingCalibration: false,
        drawingStart: null,
      });
    }
  },

  cancelDrawing: () => {
    set({
      isDrawingCalibration: false,
      drawingStart: null,
    });
  },

  setRealDistance: (cm) => {
    const { line } = get();
    if (!line || cm <= 0) return;

    const updatedLine: CalibrationLine = {
      ...line,
      realDistanceCm: cm,
    };

    const pixelsPerCm = line.pixelLength / cm;

    set({
      line: updatedLine,
      pixelsPerCm,
    });
  },

  clearCalibration: () => {
    set({
      line: null,
      pixelsPerCm: null,
      isDrawingCalibration: false,
      drawingStart: null,
    });
  },

  isCalibrated: () => {
    const { line, pixelsPerCm } = get();
    return line !== null && pixelsPerCm !== null && pixelsPerCm > 0;
  },

  getPixelsPerCm: () => {
    return get().pixelsPerCm;
  },
}));
