import { useRef, useCallback, useState, useEffect } from 'react';
import { useVideoStore } from '../stores/trackingStore';
import { useTrackingStore } from '../stores/trackingSlice';
import type { TrackingResult, BBox } from '../types';

interface UseKnnTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// Module-level vars for KNN models
let mobilenetInstance: any = null;
let knnClassifierInstance: any = null;
let modelPromise: Promise<any> | null = null;

/**
 * Load MobileNet and KNN Classifier
 */
async function loadKnnModels() {
  if (mobilenetInstance && knnClassifierInstance) {
    return { mobilenet: mobilenetInstance, knn: knnClassifierInstance };
  }

  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      console.log('[KNN] Starting model load...');

      // Load TensorFlow.js first
      const tf = await import('@tensorflow/tfjs');
      console.log('[KNN] TensorFlow.js loaded');

      // Load WebGL backend
      await import('@tensorflow/tfjs-backend-webgl');
      console.log('[KNN] WebGL backend loaded');

      // Set WebGL backend if not already active
      if (tf.getBackend() !== 'webgl') {
        await tf.setBackend('webgl');
      }
      await tf.ready();
      console.log('[KNN] TensorFlow.js ready with backend:', tf.getBackend());

      // Load MobileNet for feature extraction
      const mobilenetModule = await import('@tensorflow-models/mobilenet');
      console.log('[KNN] MobileNet module imported');

      mobilenetInstance = await mobilenetModule.load();
      console.log('[KNN] MobileNet model loaded');

      // Load KNN Classifier
      const knnModule = await import('@tensorflow-models/knn-classifier');
      console.log('[KNN] KNN Classifier module imported');

      knnClassifierInstance = knnModule.create();
      console.log('[KNN] KNN Classifier created');

      console.log('[KNN] All models loaded successfully');

      return { mobilenet: mobilenetInstance, knn: knnClassifierInstance };
    } catch (err) {
      console.error('[KNN] Model loading failed:', err);
      modelPromise = null;

      // Show user-friendly alert
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(
        'KNN 모델 로딩에 실패했습니다.\n\n' +
        '에러: ' + errorMessage + '\n\n' +
        '페이지를 새로고침(F5 또는 Cmd+R)한 후 다시 시도해주세요.\n' +
        '문제가 계속되면 브라우저 캐시를 삭제해보세요.'
      );

      throw err;
    }
  })();

  return modelPromise;
}

export function useKnnTracker({ videoRef, canvasRef }: UseKnnTrackerProps) {
  const metadata = useVideoStore((state) => state.metadata);
  const trackingConfig = useTrackingStore((state) => state.config);
  const startTracking = useTrackingStore((state) => state.startTracking);
  const stopTracking = useTrackingStore((state) => state.stopTracking);
  const setTrackingProgress = useTrackingStore((state) => state.setTrackingProgress);
  const setTrackingResults = useTrackingStore((state) => state.setTrackingResults);
  const setTrackingError = useTrackingStore((state) => state.setTrackingError);

  const setModelLoading = useTrackingStore((state) => state.setModelLoading);
  const setModelError = useTrackingStore((state) => state.setModelError);
  const isTrainingMode = useTrackingStore((state) => state.isTrainingMode);
  const setIsTrainingMode = useTrackingStore((state) => state.setIsTrainingMode);
  const targetSamples = useTrackingStore((state) => state.targetSamples);
  const backgroundSamples = useTrackingStore((state) => state.backgroundSamples);
  const setTargetSamples = useTrackingStore((state) => state.setTargetSamples);
  const setBackgroundSamples = useTrackingStore((state) => state.setBackgroundSamples);
  const setKnnReady = useTrackingStore((state) => state.setKnnReady);
  const knnReady = useTrackingStore((state) => state.knnReady);
  const resetKnnTraining = useTrackingStore((state) => state.resetKnnTraining);
  const setLatestDetections = useTrackingStore((state) => state.setLatestDetections);

  const [models, setModels] = useState<{ mobilenet: any; knn: any } | null>(null);
  const isTrackingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Initialize KNN models on mount (only if KNN method selected)
   */
  useEffect(() => {
    // CRITICAL: Only load models when this method is actually selected
    if (trackingConfig.method !== 'knn-custom') {
      return;
    }

    if (!models) {
      setModelLoading(true);
      loadKnnModels()
        .then((loadedModels) => {
          setModels(loadedModels);
          setModelLoading(false);
          setModelError(null);
        })
        .catch((error) => {
          console.error('Failed to load KNN models:', error);
          setModelError(error.message || 'Failed to load KNN models');
        });
    }
  }, [trackingConfig.method, models, setModelLoading, setModelError]);

  /**
   * Extract image patch and add to KNN classifier
   */
  const addTrainingSample = useCallback(
    async (x: number, y: number, classLabel: 'target' | 'background') => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || !models) {
        console.error('Video, canvas, or models not ready');
        return;
      }

      try {
        const windowSize = trackingConfig.knnWindowSize;
        const halfWindow = Math.floor(windowSize / 2);

        // Create temporary canvas for the patch
        const patchCanvas = document.createElement('canvas');
        patchCanvas.width = windowSize;
        patchCanvas.height = windowSize;
        const patchCtx = patchCanvas.getContext('2d');

        if (!patchCtx) return;

        // Extract patch from video
        const sx = Math.max(0, x - halfWindow);
        const sy = Math.max(0, y - halfWindow);
        const sw = Math.min(windowSize, video.videoWidth - sx);
        const sh = Math.min(windowSize, video.videoHeight - sy);

        patchCtx.drawImage(video, sx, sy, sw, sh, 0, 0, windowSize, windowSize);

        // Get feature embedding from MobileNet
        const activation = models.mobilenet.infer(patchCanvas, 'conv_preds');

        // Add to KNN classifier
        models.knn.addExample(activation, classLabel);

        // Dispose tensor
        activation.dispose();

        // Update sample counts
        if (classLabel === 'target') {
          setTargetSamples(targetSamples + 1);
        } else {
          setBackgroundSamples(backgroundSamples + 1);
        }

        // Check if ready (need at least 3 samples of each)
        const newTargetSamples = classLabel === 'target' ? targetSamples + 1 : targetSamples;
        const newBgSamples = classLabel === 'background' ? backgroundSamples + 1 : backgroundSamples;

        if (newTargetSamples >= 3 && newBgSamples >= 3) {
          setKnnReady(true);
        }

        console.log(`Added ${classLabel} sample at (${x}, ${y}). Target: ${newTargetSamples}, Background: ${newBgSamples}`);
      } catch (error) {
        console.error('Failed to add training sample:', error);
      }
    },
    [videoRef, canvasRef, models, trackingConfig.knnWindowSize, targetSamples, backgroundSamples, setTargetSamples, setBackgroundSamples, setKnnReady]
  );

  /**
   * Predict class at given position
   */
  const predictAtPosition = useCallback(
    async (x: number, y: number): Promise<{ label: string; confidence: number } | null> => {
      const video = videoRef.current;

      if (!video || !models || !knnReady) return null;

      try {
        const windowSize = trackingConfig.knnWindowSize;
        const halfWindow = Math.floor(windowSize / 2);

        // Create temporary canvas for the patch
        const patchCanvas = document.createElement('canvas');
        patchCanvas.width = windowSize;
        patchCanvas.height = windowSize;
        const patchCtx = patchCanvas.getContext('2d');

        if (!patchCtx) return null;

        // Extract patch from video
        const sx = Math.max(0, x - halfWindow);
        const sy = Math.max(0, y - halfWindow);
        const sw = Math.min(windowSize, video.videoWidth - sx);
        const sh = Math.min(windowSize, video.videoHeight - sy);

        patchCtx.drawImage(video, sx, sy, sw, sh, 0, 0, windowSize, windowSize);

        // Get feature embedding
        const activation = models.mobilenet.infer(patchCanvas, 'conv_preds');

        // Predict with KNN
        const result = await models.knn.predictClass(activation, 3); // k=3

        // Dispose tensor
        activation.dispose();

        return {
          label: result.label,
          confidence: result.confidences[result.label],
        };
      } catch (error) {
        console.error('Prediction failed:', error);
        return null;
      }
    },
    [videoRef, models, knnReady, trackingConfig.knnWindowSize]
  );

  /**
   * Search for target in current frame
   */
  const searchForTarget = useCallback(
    async (frameNumber: number, timestamp: number): Promise<TrackingResult | null> => {
      const video = videoRef.current;

      if (!video || !models || !knnReady) return null;

      const searchRadius = trackingConfig.knnSearchRadius;
      const windowSize = trackingConfig.knnWindowSize;
      const step = Math.floor(windowSize / 2); // 50% overlap

      let bestPosition: { x: number; y: number; confidence: number } | null = null;

      // Define search area
      let searchCenterX: number;
      let searchCenterY: number;

      if (lastPositionRef.current) {
        // Search around last known position
        searchCenterX = lastPositionRef.current.x;
        searchCenterY = lastPositionRef.current.y;
      } else {
        // First frame: search entire frame
        searchCenterX = video.videoWidth / 2;
        searchCenterY = video.videoHeight / 2;
      }

      const minX = Math.max(windowSize / 2, searchCenterX - searchRadius);
      const maxX = Math.min(video.videoWidth - windowSize / 2, searchCenterX + searchRadius);
      const minY = Math.max(windowSize / 2, searchCenterY - searchRadius);
      const maxY = Math.min(video.videoHeight - windowSize / 2, searchCenterY + searchRadius);

      // Sliding window search
      for (let y = minY; y < maxY; y += step) {
        for (let x = minX; x < maxX; x += step) {
          const prediction = await predictAtPosition(x, y);

          if (prediction && prediction.label === 'target' && prediction.confidence >= trackingConfig.knnConfidence) {
            if (!bestPosition || prediction.confidence > bestPosition.confidence) {
              bestPosition = { x, y, confidence: prediction.confidence };
            }
          }
        }
      }

      if (bestPosition) {
        // Update last position
        lastPositionRef.current = { x: bestPosition.x, y: bestPosition.y };

        // Update debug overlay
        const bbox: BBox = {
          x: bestPosition.x - windowSize / 2,
          y: bestPosition.y - windowSize / 2,
          width: windowSize,
          height: windowSize,
        };

        setLatestDetections([
          {
            class: 'target',
            score: bestPosition.confidence,
            bbox,
          },
        ]);

        return {
          frameNumber,
          timestamp,
          centerOfMass: { x: bestPosition.x, y: bestPosition.y, timestamp },
          pixelCount: windowSize * windowSize,
          brightnessAverage: 0,
          aiBBox: bbox,
          aiClass: 'custom-target',
          aiScore: bestPosition.confidence,
        };
      }

      // Target not found
      return {
        frameNumber,
        timestamp,
        centerOfMass: null,
        pixelCount: 0,
        brightnessAverage: 0,
      };
    },
    [videoRef, models, knnReady, trackingConfig.knnSearchRadius, trackingConfig.knnWindowSize, trackingConfig.knnConfidence, setLatestDetections, predictAtPosition]
  );

  /**
   * Run KNN tracking on entire video
   */
  const runTracking = useCallback(async () => {
    console.log('[KNN Tracking] Starting KNN-based custom tracking...');

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !metadata || !models || !knnReady) {
      const errorMsg = 'Models not loaded or not trained';
      console.error('[KNN Tracking] Cannot start:', errorMsg);
      setTrackingError(errorMsg);
      return;
    }

    console.log('[KNN Tracking] All prerequisites met. Starting tracking loop...');

    // Initialize tracking state
    startTracking();
    isTrackingRef.current = true;
    abortControllerRef.current = new AbortController();
    lastPositionRef.current = null;

    const { duration, fps } = metadata;
    const frameTime = 1 / fps;
    const sampleStep = trackingConfig.sampleEveryNthFrame;
    const totalFrames = Math.floor(duration * fps);
    const results: TrackingResult[] = [];

    // Pause video
    video.pause();

    try {
      for (let frameNumber = 0; frameNumber < totalFrames; frameNumber += sampleStep) {
        // Check if tracking was cancelled
        if (abortControllerRef.current?.signal.aborted || !isTrackingRef.current) {
          setTrackingError('Tracking cancelled');
          return;
        }

        const timestamp = frameNumber * frameTime;

        // Seek to frame
        video.currentTime = timestamp;

        // Wait for seek to complete
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          const onError = () => {
            video.removeEventListener('error', onError);
            reject(new Error('Seek failed'));
          };

          video.addEventListener('seeked', onSeeked, { once: true });
          video.addEventListener('error', onError, { once: true });

          setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            reject(new Error('Seek timeout'));
          }, 5000);
        });

        // Search for target
        const result = await searchForTarget(frameNumber, timestamp);
        if (result) {
          results.push(result);
        }

        // Update progress
        const progress = ((frameNumber + sampleStep) / totalFrames) * 100;
        setTrackingProgress(progress);

        // Yield to browser
        if (frameNumber % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Save results
      setTrackingResults(results);
      setTrackingProgress(100);
      stopTracking();

      console.log(`KNN tracking complete: ${results.length} frames processed`);
    } catch (error) {
      console.error('KNN tracking error:', error);
      setTrackingError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      isTrackingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [
    videoRef,
    canvasRef,
    metadata,
    models,
    knnReady,
    trackingConfig,
    searchForTarget,
    startTracking,
    stopTracking,
    setTrackingProgress,
    setTrackingResults,
    setTrackingError,
  ]);

  /**
   * Cancel ongoing tracking
   */
  const cancelTracking = useCallback(() => {
    isTrackingRef.current = false;
    abortControllerRef.current?.abort();
    stopTracking();
  }, [stopTracking]);

  /**
   * Start training mode
   */
  const startTraining = useCallback(() => {
    if (!models) {
      setModelError('Models not loaded');
      return;
    }

    // Clear existing training
    if (models.knn) {
      models.knn.clearAllClasses();
    }

    resetKnnTraining();
    setIsTrainingMode(true);
  }, [models, resetKnnTraining, setIsTrainingMode, setModelError]);

  /**
   * Stop training mode
   */
  const stopTraining = useCallback(() => {
    setIsTrainingMode(false);
  }, [setIsTrainingMode]);

  return {
    runTracking,
    cancelTracking,
    addTrainingSample,
    startTraining,
    stopTraining,
    isModelReady: !!models,
    isTrainingMode,
    knnReady,
    targetSamples,
    backgroundSamples,
  };
}
