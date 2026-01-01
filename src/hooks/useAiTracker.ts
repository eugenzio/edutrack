import { useRef, useCallback, useState, useEffect } from 'react';
import { useVideoStore } from '../stores/trackingStore';
import { useTrackingStore } from '../stores/trackingSlice';
import type { TrackingResult, BBox } from '../types';
import {
  cocoDetectionToBBox,
  selectBestDetection,
  selectByIoU,
  bboxCenter,
  bboxDistance,
} from '../utils/aiDetection';

interface UseAiTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// Module-level vars for single-flight loading
let modelInstance: any = null;
let modelPromise: Promise<any> | null = null;

/**
 * Lazy load TensorFlow.js and COCO-SSD model (single-flight)
 */
async function loadModel() {
  // Return cached instance if already loaded
  if (modelInstance) return modelInstance;

  // Return in-flight promise to avoid duplicate loads
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      // Load TensorFlow.js first
      const tf = await import('@tensorflow/tfjs');

      // Load WebGL backend
      await import('@tensorflow/tfjs-backend-webgl');

      // Load COCO-SSD
      const coco = await import('@tensorflow-models/coco-ssd');

      // Resolve load() method with fallback for different module shapes
      const cocoLoad = (coco as any).load ?? (coco as any).default?.load;

      if (!cocoLoad) {
        const availableKeys = Object.keys(coco as any).join(', ');
        throw new Error(
          `COCO-SSD load() method not found. Available module keys: ${availableKeys}`
        );
      }

      // Set WebGL backend if not already active
      if (tf.getBackend() !== 'webgl') {
        await tf.setBackend('webgl');
      }
      await tf.ready();

      // Load the model
      modelInstance = await cocoLoad({
        base: 'lite_mobilenet_v2', // Lighter model for faster inference
      });

      return modelInstance;
    } catch (err) {
      // Reset promise on failure to allow retry
      modelPromise = null;
      throw err;
    }
  })();

  return modelPromise;
}

export function useAiTracker({ videoRef, canvasRef }: UseAiTrackerProps) {
  const metadata = useVideoStore((state) => state.metadata);
  const trackingConfig = useTrackingStore((state) => state.config);
  const startTracking = useTrackingStore((state) => state.startTracking);
  const stopTracking = useTrackingStore((state) => state.stopTracking);
  const setTrackingProgress = useTrackingStore((state) => state.setTrackingProgress);
  const setTrackingResults = useTrackingStore((state) => state.setTrackingResults);
  const setTrackingError = useTrackingStore((state) => state.setTrackingError);

  const setModelLoading = useTrackingStore((state) => state.setModelLoading);
  const setModelError = useTrackingStore((state) => state.setModelError);
  const setDetectedClasses = useTrackingStore((state) => state.setDetectedClasses);
  const lastAiBox = useTrackingStore((state) => state.lastAiBox);
  const lastAiBoxSource = useTrackingStore((state) => state.lastAiBoxSource);
  const setLastAiBox = useTrackingStore((state) => state.setLastAiBox);
  const setLatestDetections = useTrackingStore((state) => state.setLatestDetections);
  const lostCount = useTrackingStore((state) => state.lostCount);
  const incrementLostCount = useTrackingStore((state) => state.incrementLostCount);
  const resetLostCount = useTrackingStore((state) => state.resetLostCount);
  const setIsScanningFrame = useTrackingStore((state) => state.setIsScanningFrame);
  const setScanError = useTrackingStore((state) => state.setScanError);
  const setLastScanSummary = useTrackingStore((state) => state.setLastScanSummary);
  const isLivePreview = useTrackingStore((state) => state.isLivePreview);
  const updateConfig = useTrackingStore((state) => state.updateConfig);

  const [model, setModel] = useState<any>(null);
  const isTrackingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Initialize AI model on mount (only if AI method selected)
   */
  useEffect(() => {
    if (trackingConfig.method === 'ai-object' && !model) {
      setModelLoading(true);
      loadModel()
        .then((loadedModel) => {
          setModel(loadedModel);
          setModelLoading(false);
          setModelError(null);
        })
        .catch((error) => {
          console.error('Failed to load AI model:', error);
          setModelError(error.message || 'Failed to load AI model');
        });
    }
  }, [trackingConfig.method, model, setModelLoading, setModelError]);

  /**
   * Run warmup detection on current frame to populate detected classes
   * Provides comprehensive diagnostics for troubleshooting
   */
  const warmupDetection = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      setScanError('Video not ready');
      return;
    }

    // Set scanning state
    setIsScanningFrame(true);
    setScanError(null);

    try {
      // Set loading state if model not loaded yet
      if (!model) {
        setModelLoading(true);
      }

      // Ensure model is loaded first
      const loadedModel = model || await loadModel();

      // Update state if model was just loaded
      if (!model && loadedModel) {
        setModel(loadedModel);
        setModelLoading(false);
        setModelError(null);
      }

      // Ensure video frame is ready
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('canplay', onReady);
            resolve();
          };
          video.addEventListener('loadeddata', onReady, { once: true });
          video.addEventListener('canplay', onReady, { once: true });

          // Timeout after 5 seconds
          setTimeout(() => {
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('canplay', onReady);
            resolve();
          }, 5000);
        });
      }

      // Wait for a frame callback if available
      if ('requestVideoFrameCallback' in video) {
        await new Promise<void>((resolve) => {
          (video as any).requestVideoFrameCallback(() => resolve());
        });
      }

      console.log(`Scanning at confidence ${(trackingConfig.aiConfidence * 100).toFixed(0)}%`);

      // Run detection on video element directly
      const predictions = await loadedModel.detect(video);

      // Raw predictions count
      const rawPredictions = predictions.length;

      // Filter by confidence
      const filteredPredictions = predictions.filter(
        (p: any) => p.score >= trackingConfig.aiConfidence
      );

      // Convert filtered predictions to BBox format
      const filteredDetections = filteredPredictions.map(cocoDetectionToBBox);

      // Get max score from all predictions
      const maxScore = predictions.length > 0
        ? Math.max(...predictions.map((p: any) => p.score))
        : 0;

      // Get top 5 classes by score from raw predictions
      const sortedByScore = [...predictions]
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 5);
      const topClasses = sortedByScore.map((p: any) => ({
        cls: p.class,
        score: p.score,
      }));

      // Get unique classes from filtered detections
      const uniqueClassesSet = new Set<string>();
      filteredDetections.forEach((d: { class: string }) => uniqueClassesSet.add(d.class));
      const uniqueClasses = Array.from(uniqueClassesSet);

      // Update detected classes
      setDetectedClasses(uniqueClasses);
      setLatestDetections(filteredDetections);

      // Set comprehensive scan summary
      setLastScanSummary({
        at: Date.now(),
        rawPredictions,
        filteredDetections: filteredDetections.length,
        maxScore,
        topClasses,
      });

      console.log(`Scan complete:`);
      console.log(`  Raw predictions: ${rawPredictions}`);
      console.log(`  Filtered detections: ${filteredDetections.length}`);
      console.log(`  Max score: ${maxScore.toFixed(3)}`);
      console.log(`  Top classes:`, topClasses);
      console.log(`  Unique filtered classes: ${uniqueClasses.join(', ') || 'none'}`);

      // Auto-clear target class if it's not in detected classes
      if (trackingConfig.aiTargetClass && !uniqueClasses.includes(trackingConfig.aiTargetClass)) {
        console.warn(`Target class "${trackingConfig.aiTargetClass}" not found in scan, clearing`);
        updateConfig({ aiTargetClass: null });
        setScanError('Target class not detected. Select a class from detected classes.');
      } else if (filteredDetections.length === 0) {
        // No detections after filtering
        if (rawPredictions > 0) {
          setScanError(
            `No detections above ${(trackingConfig.aiConfidence * 100).toFixed(0)}% confidence. Try lowering to 10-30%.`
          );
        } else {
          setScanError(
            'No objects detected in frame. Try playing the video or adjusting the view.'
          );
        }
      }
    } catch (error) {
      console.error('Warmup detection failed:', error);
      setScanError(error instanceof Error ? error.message : 'Warmup failed');
      setModelError(error instanceof Error ? error.message : 'Warmup failed');
    } finally {
      setIsScanningFrame(false);
    }
  }, [
    videoRef,
    model,
    trackingConfig.aiConfidence,
    trackingConfig.aiTargetClass,
    setDetectedClasses,
    setLatestDetections,
    setModelLoading,
    setModelError,
    setIsScanningFrame,
    setScanError,
    setLastScanSummary,
    updateConfig,
  ]);

  /**
   * Live preview: periodically run detection while video is playing
   */
  useEffect(() => {
    if (!isLivePreview || !model || trackingConfig.method !== 'ai-object') {
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isRunning = false;

    const runLiveDetection = async () => {
      if (isRunning || !video || video.paused || video.ended) return;

      isRunning = true;
      try {
        const predictions = await model.detect(video);

        // Filter by confidence
        const filteredPredictions = predictions.filter(
          (p: any) => p.score >= trackingConfig.aiConfidence
        );

        // Convert to BBox format
        const filteredDetections = filteredPredictions.map(cocoDetectionToBBox);

        // Update detections for debug overlay
        setLatestDetections(filteredDetections);

        // Update detected classes (throttled)
        const uniqueClassesSet = new Set<string>();
        filteredDetections.forEach((d: { class: string }) => uniqueClassesSet.add(d.class));
        const uniqueClasses = Array.from(uniqueClassesSet);

        if (uniqueClasses.length > 0) {
          setDetectedClasses(uniqueClasses);
        }
      } catch (error) {
        console.error('Live preview detection failed:', error);
      } finally {
        isRunning = false;
      }
    };

    // Run detection every 300ms (~3 FPS)
    intervalId = setInterval(runLiveDetection, 300);

    // Cleanup on unmount or toggle off
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    isLivePreview,
    model,
    videoRef,
    trackingConfig.method,
    trackingConfig.aiConfidence,
    setLatestDetections,
    setDetectedClasses,
  ]);

  /**
   * Process a single frame with AI detection
   */
  const processFrame = useCallback(
    async (frameNumber: number, timestamp: number): Promise<TrackingResult | null> => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || !model) return null;

      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
      if (!ctx) return null;

      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        // Run COCO-SSD detection
        const predictions = await model.detect(canvas);

        // Convert to BBox format and filter
        const allDetections = predictions
          .filter((p: any) => p.score >= trackingConfig.aiConfidence)
          .map(cocoDetectionToBBox);

        // Store all detections for debug overlay
        setLatestDetections(allDetections);

        // Filter by target class (if specified)
        const targetDetections = trackingConfig.aiTargetClass
          ? allDetections.filter((d: { class: string; score: number; bbox: BBox }) => d.class === trackingConfig.aiTargetClass)
          : [];

        if (targetDetections.length === 0) {
          // No target detected
          incrementLostCount();

          // Check lost frame tolerance
          if (lostCount >= trackingConfig.aiLostFrameTolerance) {
            // Lost target, reset tracking state
            setLastAiBox(null, 'auto');
            return {
              frameNumber,
              timestamp,
              centerOfMass: null,
              pixelCount: 0,
              brightnessAverage: 0,
            };
          } else {
            // Within tolerance: use last known position
            if (lastAiBox) {
              const center = bboxCenter(lastAiBox);
              return {
                frameNumber,
                timestamp,
                centerOfMass: { ...center, timestamp },
                pixelCount: 0,
                brightnessAverage: 0,
                aiBBox: lastAiBox,
                aiClass: trackingConfig.aiTargetClass || undefined,
                aiScore: 0, // Indicate lost frame
              };
            } else {
              return {
                frameNumber,
                timestamp,
                centerOfMass: null,
                pixelCount: 0,
                brightnessAverage: 0,
              };
            }
          }
        }

        // Select best detection
        let selectedDetection: { bbox: BBox; score: number; class: string } | null = null;

        if (lastAiBoxSource === 'user' && lastAiBox) {
          // User-locked: select by max IoU
          const byIoU = selectByIoU(targetDetections, lastAiBox);
          if (byIoU) {
            selectedDetection = {
              ...byIoU,
              class: trackingConfig.aiTargetClass!,
            };
          }
        } else {
          // Auto-selection: use strategy
          const byStrategy = selectBestDetection(
            targetDetections,
            trackingConfig.aiTrackStrategy,
            lastAiBox
          );
          if (byStrategy) {
            selectedDetection = {
              ...byStrategy,
              class: trackingConfig.aiTargetClass!,
            };
          }
        }

        if (!selectedDetection) {
          incrementLostCount();
          return {
            frameNumber,
            timestamp,
            centerOfMass: null,
            pixelCount: 0,
            brightnessAverage: 0,
          };
        }

        // Anti-jump validation
        if (lastAiBox && trackingConfig.aiMaxJumpPx > 0) {
          const distance = bboxDistance(selectedDetection.bbox, lastAiBox);
          if (distance > trackingConfig.aiMaxJumpPx) {
            // Reject jump, keep previous box
            incrementLostCount();
            const center = bboxCenter(lastAiBox);
            return {
              frameNumber,
              timestamp,
              centerOfMass: { ...center, timestamp },
              pixelCount: 0,
              brightnessAverage: 0,
              aiBBox: lastAiBox,
              aiClass: selectedDetection.class,
              aiScore: selectedDetection.score,
            };
          }
        }

        // Update last box
        setLastAiBox(selectedDetection.bbox, lastAiBoxSource);
        resetLostCount();

        // Build result
        const center = bboxCenter(selectedDetection.bbox);
        return {
          frameNumber,
          timestamp,
          centerOfMass: { ...center, timestamp },
          pixelCount: Math.round(selectedDetection.bbox.width * selectedDetection.bbox.height),
          brightnessAverage: 0, // Not applicable for AI tracking
          aiBBox: selectedDetection.bbox,
          aiClass: selectedDetection.class,
          aiScore: selectedDetection.score,
        };
      } catch (error) {
        console.error('AI detection failed:', error);
        return null;
      }
    },
    [
      videoRef,
      canvasRef,
      model,
      trackingConfig,
      lastAiBox,
      lastAiBoxSource,
      lostCount,
      setLastAiBox,
      setLatestDetections,
      incrementLostCount,
      resetLostCount,
    ]
  );

  /**
   * Run AI tracking on entire video
   */
  const runTracking = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !metadata || !model) {
      setTrackingError('Video or model not loaded');
      return;
    }

    if (!trackingConfig.aiTargetClass) {
      setTrackingError('Please select a target class');
      return;
    }

    // Initialize tracking state
    startTracking();
    isTrackingRef.current = true;
    abortControllerRef.current = new AbortController();

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

        // Process frame
        const result = await processFrame(frameNumber, timestamp);
        if (result) {
          results.push(result);
        }

        // Update progress
        const progress = ((frameNumber + sampleStep) / totalFrames) * 100;
        setTrackingProgress(progress);

        // Yield to browser (prevent UI freezing)
        if (frameNumber % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Save results
      setTrackingResults(results);
      setTrackingProgress(100);
      stopTracking();

      console.log(`AI tracking complete: ${results.length} frames processed`);
    } catch (error) {
      console.error('AI tracking error:', error);
      setTrackingError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      isTrackingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [
    videoRef,
    canvasRef,
    metadata,
    model,
    trackingConfig,
    processFrame,
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

  return {
    runTracking,
    cancelTracking,
    warmupDetection,
    isModelReady: !!model,
  };
}
