import { create } from 'zustand';
import type { TrackingState, TrackingConfiguration, TrackingResult, TrackingMetrics, BBox, AiBoxSource } from '../types';

interface TrackingStore extends TrackingState {
  // Actions
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
  setTrackingProgress: (progress: number) => void;
  addTrackingResult: (result: TrackingResult) => void;
  setTrackingResults: (results: TrackingResult[]) => void;
  updateConfig: (config: Partial<TrackingConfiguration>) => void;
  setTrackingError: (error: string | null) => void;

  // NEW: AI model state
  isModelLoading: boolean;
  modelError: string | null;
  detectedClasses: string[];

  // NEW: AI tracking continuity state
  lastAiBox: BBox | null;
  lastAiBoxSource: AiBoxSource;
  latestDetections: Array<{ class: string; score: number; bbox: BBox }>;
  lostCount: number;
  showDebugOverlay: boolean;

  // NEW: Scan frame state
  isScanningFrame: boolean;
  scanError: string | null;
  lastScanSummary: {
    at: number;
    rawPredictions: number;
    filteredDetections: number;
    maxScore: number;
    topClasses: Array<{ cls: string; score: number }>;
  } | null;
  isLivePreview: boolean;

  // NEW: KNN training state
  isTrainingMode: boolean;
  targetSamples: number;
  backgroundSamples: number;
  knnReady: boolean;

  // NEW: AI-specific actions
  setModelLoading: (loading: boolean) => void;
  setModelError: (error: string | null) => void;
  setDetectedClasses: (classes: string[]) => void;
  setLastAiBox: (bbox: BBox | null, source: AiBoxSource) => void;
  setLatestDetections: (detections: Array<{ class: string; score: number; bbox: BBox }>) => void;
  incrementLostCount: () => void;
  resetLostCount: () => void;
  clearAiLock: () => void;
  setShowDebugOverlay: (show: boolean) => void;
  setIsScanningFrame: (scanning: boolean) => void;
  setScanError: (error: string | null) => void;
  setLastScanSummary: (summary: {
    at: number;
    rawPredictions: number;
    filteredDetections: number;
    maxScore: number;
    topClasses: Array<{ cls: string; score: number }>;
  } | null) => void;
  setIsLivePreview: (enabled: boolean) => void;
  setIsTrainingMode: (enabled: boolean) => void;
  setTargetSamples: (count: number) => void;
  setBackgroundSamples: (count: number) => void;
  setKnnReady: (ready: boolean) => void;
  resetKnnTraining: () => void;

  // Computed getters
  getTrackingMetrics: () => TrackingMetrics;
  isTrackingComplete: () => boolean;
  hasTrackingData: () => boolean;
}

const DEFAULT_CONFIG: TrackingConfiguration = {
  brightnessThreshold: 200,
  minPixelCount: 10,
  sampleEveryNthFrame: 1,

  // NEW: AI defaults
  method: 'ai-object',
  aiConfidence: 0.5,
  aiTargetClass: null,
  aiTrackStrategy: 'nearestPrev',
  aiMaxJumpPx: 200,
  aiLostFrameTolerance: 5,

  // NEW: KNN defaults
  knnWindowSize: 80,
  knnSearchRadius: 100,
  knnConfidence: 0.6,
};

export const useTrackingStore = create<TrackingStore>((set, get) => ({
  // Initial state
  isTracking: false,
  trackingProgress: 0,
  results: [],
  config: DEFAULT_CONFIG,
  error: null,

  // NEW: AI initial state
  isModelLoading: false,
  modelError: null,
  detectedClasses: [],
  lastAiBox: null,
  lastAiBoxSource: 'auto',
  latestDetections: [],
  lostCount: 0,
  showDebugOverlay: false,

  // NEW: Scan frame initial state
  isScanningFrame: false,
  scanError: null,
  lastScanSummary: null,
  isLivePreview: false,

  // NEW: KNN training initial state
  isTrainingMode: false,
  targetSamples: 0,
  backgroundSamples: 0,
  knnReady: false,

  // Actions
  startTracking: () => {
    set({
      isTracking: true,
      trackingProgress: 0,
      results: [],
      error: null,
    });
  },

  stopTracking: () => {
    set({ isTracking: false });
  },

  resetTracking: () => {
    set({
      isTracking: false,
      trackingProgress: 0,
      results: [],
      error: null,
      // NEW: Reset AI state
      lastAiBox: null,
      lastAiBoxSource: 'auto',
      latestDetections: [],
      lostCount: 0,
    });
  },

  setTrackingProgress: (progress: number) => {
    set({ trackingProgress: Math.min(100, Math.max(0, progress)) });
  },

  addTrackingResult: (result: TrackingResult) => {
    set((state) => ({
      results: [...state.results, result],
    }));
  },

  setTrackingResults: (results: TrackingResult[]) => {
    set({ results });
  },

  updateConfig: (config: Partial<TrackingConfiguration>) => {
    set((state) => ({
      config: { ...state.config, ...config },
    }));
  },

  setTrackingError: (error: string | null) => {
    set({ error, isTracking: false });
  },

  // NEW: AI-specific actions
  setModelLoading: (loading: boolean) => {
    set({ isModelLoading: loading });
  },

  setModelError: (error: string | null) => {
    set({ modelError: error, isModelLoading: false });
  },

  setDetectedClasses: (classes: string[]) => {
    set({ detectedClasses: classes });
  },

  setLastAiBox: (bbox: BBox | null, source: AiBoxSource) => {
    set({ lastAiBox: bbox, lastAiBoxSource: source, lostCount: 0 });
  },

  setLatestDetections: (detections: Array<{ class: string; score: number; bbox: BBox }>) => {
    set({ latestDetections: detections });
  },

  incrementLostCount: () => {
    set((state) => ({ lostCount: state.lostCount + 1 }));
  },

  resetLostCount: () => {
    set({ lostCount: 0 });
  },

  clearAiLock: () => {
    set({ lastAiBox: null, lastAiBoxSource: 'auto' });
  },

  setShowDebugOverlay: (show: boolean) => {
    set({ showDebugOverlay: show });
  },

  setIsScanningFrame: (scanning: boolean) => {
    set({ isScanningFrame: scanning });
  },

  setScanError: (error: string | null) => {
    set({ scanError: error });
  },

  setLastScanSummary: (summary: {
    at: number;
    rawPredictions: number;
    filteredDetections: number;
    maxScore: number;
    topClasses: Array<{ cls: string; score: number }>;
  } | null) => {
    set({ lastScanSummary: summary });
  },

  setIsLivePreview: (enabled: boolean) => {
    set({ isLivePreview: enabled });
  },

  setIsTrainingMode: (enabled: boolean) => {
    set({ isTrainingMode: enabled });
  },

  setTargetSamples: (count: number) => {
    set({ targetSamples: count });
  },

  setBackgroundSamples: (count: number) => {
    set({ backgroundSamples: count });
  },

  setKnnReady: (ready: boolean) => {
    set({ knnReady: ready });
  },

  resetKnnTraining: () => {
    set({
      targetSamples: 0,
      backgroundSamples: 0,
      knnReady: false,
      isTrainingMode: false,
    });
  },

  // Computed getters
  getTrackingMetrics: () => {
    const results = get().results;

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
        const dx = curr.centerOfMass.x - prev.centerOfMass.x;
        const dy = curr.centerOfMass.y - prev.centerOfMass.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        totalDistance += distance;

        const timeDiff = curr.timestamp - prev.timestamp;
        if (timeDiff > 0) {
          speeds.push(distance / timeDiff);
        }
      }
    }

    return {
      totalDistance,
      totalDistanceScaled: totalDistance,
      averageSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
      minSpeed: speeds.length > 0 && speeds.length === successfulDetections - 1
        ? Math.min(...speeds)
        : 0,
      totalFramesTracked: results.length,
      successfulDetections,
      failedDetections,
    };
  },

  isTrackingComplete: () => {
    const state = get();
    return !state.isTracking && state.trackingProgress === 100 && state.results.length > 0;
  },

  hasTrackingData: () => {
    return get().results.length > 0;
  },
}));
