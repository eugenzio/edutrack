import { useRef, useCallback, useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { useVideoStore } from '../stores/trackingStore';
import { useTrackingStore } from '../stores/trackingSlice';
import type { TrackingResult, MousePose, Point } from '../types';

// Processing optimization constants
const PROCESSING_WIDTH = 256; // Smaller for pose model (faster inference)
const PROGRESS_THROTTLE_MS = 200;
const LOG_THROTTLE_MS = 500;

// MoveNet keypoint indices (COCO format)
const KEYPOINT_INDICES = {
  NOSE: 0,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
};

interface UsePoseTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

/**
 * MoveNet-based pose tracker for rodent tracking
 * Maps human pose keypoints to rodent anatomy (snout, body, tail)
 */
export function usePoseTracker({ videoRef }: UsePoseTrackerProps) {
  const metadata = useVideoStore((state) => state.metadata);
  const trackingConfig = useTrackingStore((state) => state.config);
  const startTracking = useTrackingStore((state) => state.startTracking);
  const stopTracking = useTrackingStore((state) => state.stopTracking);
  const setTrackingProgress = useTrackingStore((state) => state.setTrackingProgress);
  const setTrackingResults = useTrackingStore((state) => state.setTrackingResults);
  const setTrackingError = useTrackingStore((state) => state.setTrackingError);

  // Pose model state from store
  const isPoseModelLoading = useTrackingStore((state) => state.isPoseModelLoading);
  const isPoseModelReady = useTrackingStore((state) => state.isPoseModelReady);
  const poseModelError = useTrackingStore((state) => state.poseModelError);
  const poseBackend = useTrackingStore((state) => state.poseBackend);
  const setPoseModelLoading = useTrackingStore((state) => state.setPoseModelLoading);
  const setPoseModelReady = useTrackingStore((state) => state.setPoseModelReady);
  const setPoseModelError = useTrackingStore((state) => state.setPoseModelError);
  const setPoseBackend = useTrackingStore((state) => state.setPoseBackend);
  const resetPoseModel = useTrackingStore((state) => state.resetPoseModel);

  const [isReady, setIsReady] = useState(false);

  const isTrackingRef = useRef(false);
  const frameCallbackIdRef = useRef<number | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scaleFactorsRef = useRef<{ scaleX: number; scaleY: number } | null>(null);
  const lastProgressUpdateRef = useRef<number>(0);
  const lastLogTimeRef = useRef<number>(0);
  const originalPlaybackRateRef = useRef<number>(1);
  const endedHandlerRef = useRef<(() => void) | null>(null);
  const errorHandlerRef = useRef<((event: Event) => void) | null>(null);

  // Pose model reference
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);

  // Temporal smoothing state
  const lastPoseRef = useRef<MousePose | null>(null);

  /**
   * Initialize TensorFlow.js backend (WASM preferred, WebGL fallback)
   */
  const initializeBackend = useCallback(async (): Promise<string> => {
    console.log('[Pose Tracker] Initializing TensorFlow.js backend...');

    // Try WASM first (better for Chromebooks and consistent performance)
    try {
      await tf.setBackend('wasm');
      await tf.ready();
      console.log('[Pose Tracker] WASM backend initialized');
      return 'wasm';
    } catch (wasmError) {
      console.warn('[Pose Tracker] WASM failed, trying WebGL...', wasmError);
    }

    // Fallback to WebGL
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('[Pose Tracker] WebGL backend initialized');
      return 'webgl';
    } catch (webglError) {
      console.warn('[Pose Tracker] WebGL failed, trying CPU...', webglError);
    }

    // Last resort: CPU
    await tf.setBackend('cpu');
    await tf.ready();
    console.log('[Pose Tracker] CPU backend initialized (slow)');
    return 'cpu';
  }, []);

  /**
   * Load MoveNet model
   */
  const loadModel = useCallback(async () => {
    if (isPoseModelLoading || isPoseModelReady) {
      console.log('[Pose Tracker] Model already loading or ready');
      return;
    }

    try {
      setPoseModelLoading(true);
      setPoseModelError(null);

      // Initialize backend
      const backend = await initializeBackend();
      setPoseBackend(backend);

      // Determine model type from config
      const modelType = trackingConfig.poseModelType === 'thunder'
        ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
        : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;

      console.log(`[Pose Tracker] Loading MoveNet ${trackingConfig.poseModelType}...`);

      // Create detector
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType,
          enableSmoothing: trackingConfig.poseSmoothing,
        }
      );

      detectorRef.current = detector;
      setPoseModelReady(true);
      console.log('[Pose Tracker] MoveNet model loaded successfully');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load pose model';
      console.error('[Pose Tracker] Model loading failed:', error);
      setPoseModelError(message);
    }
  }, [
    isPoseModelLoading,
    isPoseModelReady,
    trackingConfig.poseModelType,
    trackingConfig.poseSmoothing,
    initializeBackend,
    setPoseModelLoading,
    setPoseModelReady,
    setPoseModelError,
    setPoseBackend,
  ]);

  /**
   * Unload model and clean up
   */
  const unloadModel = useCallback(() => {
    if (detectorRef.current) {
      detectorRef.current.dispose();
      detectorRef.current = null;
    }
    resetPoseModel();
    console.log('[Pose Tracker] Model unloaded');
  }, [resetPoseModel]);

  /**
   * Initialize processing canvas
   */
  useEffect(() => {
    if (trackingConfig.method !== 'movenet-pose') {
      setIsReady(false);
      return;
    }

    if (!metadata) {
      setIsReady(false);
      return;
    }

    if (!processingCanvasRef.current) {
      const aspectRatio = metadata.height / metadata.width;
      const processingHeight = Math.round(PROCESSING_WIDTH * aspectRatio);

      const processingCanvas = document.createElement('canvas');
      processingCanvas.width = PROCESSING_WIDTH;
      processingCanvas.height = processingHeight;
      processingCanvasRef.current = processingCanvas;

      scaleFactorsRef.current = {
        scaleX: metadata.width / PROCESSING_WIDTH,
        scaleY: metadata.height / processingHeight,
      };

      console.log(`[Pose Tracker] Processing canvas: ${PROCESSING_WIDTH}x${processingHeight}`);
    }

    setIsReady(true);
  }, [trackingConfig.method, metadata]);

  /**
   * Map human keypoints to rodent pose
   */
  const mapToMousePose = useCallback((
    keypoints: poseDetection.Keypoint[],
    timestamp: number,
    minConfidence: number
  ): MousePose => {
    const getKeypoint = (index: number): Point | null => {
      const kp = keypoints[index];
      if (!kp || (kp.score !== undefined && kp.score < minConfidence)) {
        return null;
      }
      return { x: kp.x, y: kp.y, timestamp };
    };

    const getMidpoint = (idx1: number, idx2: number): Point | null => {
      const kp1 = keypoints[idx1];
      const kp2 = keypoints[idx2];

      if (!kp1 || !kp2) return null;

      const score1 = kp1.score ?? 0;
      const score2 = kp2.score ?? 0;

      if (score1 < minConfidence || score2 < minConfidence) {
        // Use the one with higher confidence if one is good
        if (score1 >= minConfidence) {
          return { x: kp1.x, y: kp1.y, timestamp };
        }
        if (score2 >= minConfidence) {
          return { x: kp2.x, y: kp2.y, timestamp };
        }
        return null;
      }

      return {
        x: (kp1.x + kp2.x) / 2,
        y: (kp1.y + kp2.y) / 2,
        timestamp,
      };
    };

    return {
      snout: getKeypoint(KEYPOINT_INDICES.NOSE),
      bodyCenter: getMidpoint(KEYPOINT_INDICES.LEFT_SHOULDER, KEYPOINT_INDICES.RIGHT_SHOULDER),
      tailBase: getMidpoint(KEYPOINT_INDICES.LEFT_HIP, KEYPOINT_INDICES.RIGHT_HIP),
    };
  }, []);

  /**
   * Apply temporal smoothing to pose
   */
  const smoothPose = useCallback((
    currentPose: MousePose,
    alpha: number = 0.4
  ): MousePose => {
    const lastPose = lastPoseRef.current;
    if (!lastPose) {
      lastPoseRef.current = currentPose;
      return currentPose;
    }

    const smoothPoint = (curr: Point | null, prev: Point | null): Point | null => {
      if (!curr) return prev;
      if (!prev) return curr;
      return {
        x: alpha * curr.x + (1 - alpha) * prev.x,
        y: alpha * curr.y + (1 - alpha) * prev.y,
        timestamp: curr.timestamp,
      };
    };

    const smoothed: MousePose = {
      snout: smoothPoint(currentPose.snout, lastPose.snout),
      bodyCenter: smoothPoint(currentPose.bodyCenter, lastPose.bodyCenter),
      tailBase: smoothPoint(currentPose.tailBase, lastPose.tailBase),
    };

    lastPoseRef.current = smoothed;
    return smoothed;
  }, []);

  /**
   * Process a single frame with MoveNet
   */
  const processFrame = useCallback(
    async (timestamp: number, frameNumber: number): Promise<TrackingResult | null> => {
      const video = videoRef.current;
      const processingCanvas = processingCanvasRef.current;
      const detector = detectorRef.current;
      const scaleFactors = scaleFactorsRef.current;

      if (!video || !processingCanvas || !detector || !scaleFactors) {
        return null;
      }

      const ctx = processingCanvas.getContext('2d');
      if (!ctx) return null;

      const { width, height } = processingCanvas;

      // Draw downscaled frame
      ctx.drawImage(
        video,
        0, 0, video.videoWidth, video.videoHeight,
        0, 0, width, height
      );

      try {
        // Run pose estimation
        const poses = await detector.estimatePoses(processingCanvas);

        if (poses.length === 0 || !poses[0].keypoints) {
          return {
            frameNumber,
            timestamp,
            centerOfMass: null,
            pixelCount: 0,
            brightnessAverage: 0,
            pose: { snout: null, bodyCenter: null, tailBase: null },
            poseConfidence: 0,
          };
        }

        const pose = poses[0];
        const keypoints = pose.keypoints;

        // Calculate average confidence
        const confidences = keypoints
          .map(kp => kp.score ?? 0)
          .filter(s => s > 0);
        const avgConfidence = confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0;

        // Check minimum confidence threshold
        if (avgConfidence < trackingConfig.poseMinConfidence) {
          return {
            frameNumber,
            timestamp,
            centerOfMass: null,
            pixelCount: 0,
            brightnessAverage: 0,
            pose: { snout: null, bodyCenter: null, tailBase: null },
            poseConfidence: avgConfidence,
          };
        }

        // Map to mouse pose (in processing coordinates)
        let mousePose = mapToMousePose(
          keypoints,
          timestamp,
          trackingConfig.poseKeypointConfidence
        );

        // Apply temporal smoothing if enabled
        if (trackingConfig.poseSmoothing) {
          mousePose = smoothPose(mousePose);
        }

        // Scale coordinates back to original video resolution
        const scalePoint = (p: Point | null): Point | null => {
          if (!p) return null;
          return {
            x: p.x * scaleFactors.scaleX,
            y: p.y * scaleFactors.scaleY,
            timestamp: p.timestamp,
          };
        };

        const scaledPose: MousePose = {
          snout: scalePoint(mousePose.snout),
          bodyCenter: scalePoint(mousePose.bodyCenter),
          tailBase: scalePoint(mousePose.tailBase),
        };

        // Use body center as primary center of mass
        const centerOfMass = scaledPose.bodyCenter;

        return {
          frameNumber,
          timestamp,
          centerOfMass,
          pixelCount: 0, // Not applicable for pose tracking
          brightnessAverage: 0,
          pose: scaledPose,
          poseConfidence: avgConfidence,
        };

      } catch (error) {
        console.error('[Pose Tracker] Frame processing error:', error);
        return null;
      }
    },
    [videoRef, trackingConfig, mapToMousePose, smoothPose]
  );

  /**
   * Run tracking using requestVideoFrameCallback
   */
  const runTracking = useCallback(async () => {
    console.log('[Pose Tracker] Starting MoveNet tracking...');

    const video = videoRef.current;
    const detector = detectorRef.current;

    if (!video || !metadata) {
      setTrackingError('Video or metadata not ready');
      return;
    }

    if (!detector) {
      setTrackingError('Pose model not loaded. Click "Load Model" first.');
      return;
    }

    if (!('requestVideoFrameCallback' in video)) {
      setTrackingError('Browser does not support requestVideoFrameCallback');
      return;
    }

    // Initialize tracking state
    startTracking();
    isTrackingRef.current = true;
    lastPoseRef.current = null;

    const { duration, fps } = metadata;
    const sampleStep = trackingConfig.sampleEveryNthFrame;
    const totalFrames = Math.floor(duration * fps);
    const results: TrackingResult[] = [];
    const nearEndThreshold = Math.max(1 / fps, (sampleStep / fps) * 1.5);

    let frameCount = 0;
    let lastProcessedFrame = -sampleStep;

    originalPlaybackRateRef.current = video.playbackRate;
    let trackingFinished = false;

    const cancelFrameCallback = () => {
      if (frameCallbackIdRef.current !== null && 'cancelVideoFrameCallback' in video) {
        (video as any).cancelVideoFrameCallback(frameCallbackIdRef.current);
        frameCallbackIdRef.current = null;
      }
    };

    const finishTracking = () => {
      if (trackingFinished) return;
      trackingFinished = true;

      if (endedHandlerRef.current) {
        video.removeEventListener('ended', endedHandlerRef.current);
        endedHandlerRef.current = null;
      }
      if (errorHandlerRef.current) {
        video.removeEventListener('error', errorHandlerRef.current);
        errorHandlerRef.current = null;
      }
      cancelFrameCallback();
      video.pause();
      video.playbackRate = originalPlaybackRateRef.current;
      setTrackingResults(results);
      setTrackingProgress(100);
      stopTracking();
      isTrackingRef.current = false;
      console.log('[Pose Tracker] Tracking completed');
    };

    const failTracking = (message: string, err?: unknown) => {
      if (trackingFinished) return;
      trackingFinished = true;

      console.error('[Pose Tracker] Tracking failed:', err ?? message);
      if (endedHandlerRef.current) {
        video.removeEventListener('ended', endedHandlerRef.current);
        endedHandlerRef.current = null;
      }
      if (errorHandlerRef.current) {
        video.removeEventListener('error', errorHandlerRef.current);
        errorHandlerRef.current = null;
      }
      cancelFrameCallback();
      video.pause();
      video.playbackRate = originalPlaybackRateRef.current;
      setTrackingError(message);
      stopTracking();
      isTrackingRef.current = false;
    };

    const handlePlaybackError = (event: Event) => {
      failTracking('Video playback error', event);
    };

    endedHandlerRef.current = finishTracking;
    errorHandlerRef.current = handlePlaybackError;

    try {
      // Slower playback for pose inference (async)
      video.playbackRate = 0.5;
      video.currentTime = 0;

      // Wait for seek
      await new Promise<void>((resolve, reject) => {
        if (video.currentTime === 0 && video.readyState >= 3) {
          resolve();
          return;
        }

        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('Seek failed'));
        };
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('Seek timeout'));
        }, 5000);

        const cleanup = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          clearTimeout(timeoutId);
        };

        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
      });

      await video.play();

      video.addEventListener('ended', finishTracking);
      video.addEventListener('error', handlePlaybackError);

      // rVFC frame processor
      const processVideoFrame = async () => {
        try {
          if (!isTrackingRef.current) {
            video.pause();
            return;
          }

          if (video.currentTime >= duration || video.ended || duration - video.currentTime <= nearEndThreshold) {
            finishTracking();
            return;
          }

          frameCount++;

          if (frameCount - lastProcessedFrame >= sampleStep) {
            lastProcessedFrame = frameCount;

            const timestamp = video.currentTime;
            const frameNumber = Math.floor(timestamp * fps);

            // Process frame (async pose estimation)
            const result = await processFrame(timestamp, frameNumber);
            if (result) {
              results.push(result);
            }

            const progress = (timestamp / duration) * 100;
            const now = performance.now();

            if (now - lastProgressUpdateRef.current >= PROGRESS_THROTTLE_MS) {
              setTrackingProgress(progress);
              setTrackingResults([...results]);
              lastProgressUpdateRef.current = now;
            }

            if (now - lastLogTimeRef.current >= LOG_THROTTLE_MS) {
              console.log(`[Pose Tracker] Frame ${frameNumber}/${totalFrames} (${progress.toFixed(1)}%)`);
              lastLogTimeRef.current = now;
            }
          }

          if (isTrackingRef.current && !video.ended) {
            frameCallbackIdRef.current = (video as any).requestVideoFrameCallback(processVideoFrame);
          } else if (isTrackingRef.current) {
            finishTracking();
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown processing error';
          failTracking(message, err);
        }
      };

      frameCallbackIdRef.current = (video as any).requestVideoFrameCallback(processVideoFrame);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      failTracking(message, error);
    }
  }, [
    videoRef,
    metadata,
    trackingConfig.sampleEveryNthFrame,
    processFrame,
    startTracking,
    stopTracking,
    setTrackingProgress,
    setTrackingResults,
    setTrackingError,
  ]);

  /**
   * Cancel tracking
   */
  const cancelTracking = useCallback(() => {
    console.log('[Pose Tracker] Cancelling tracking...');
    isTrackingRef.current = false;

    const video = videoRef.current;
    if (video && frameCallbackIdRef.current !== null && 'cancelVideoFrameCallback' in video) {
      (video as any).cancelVideoFrameCallback(frameCallbackIdRef.current);
      frameCallbackIdRef.current = null;
    }
    if (video) {
      if (endedHandlerRef.current) {
        video.removeEventListener('ended', endedHandlerRef.current);
        endedHandlerRef.current = null;
      }
      if (errorHandlerRef.current) {
        video.removeEventListener('error', errorHandlerRef.current);
        errorHandlerRef.current = null;
      }
      video.pause();
      video.playbackRate = originalPlaybackRateRef.current;
    }

    stopTracking();
  }, [videoRef, stopTracking]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (frameCallbackIdRef.current !== null) {
        const video = videoRef.current;
        if (video && 'cancelVideoFrameCallback' in video) {
          (video as any).cancelVideoFrameCallback(frameCallbackIdRef.current);
        }
      }
      const video = videoRef.current;
      if (video) {
        if (endedHandlerRef.current) {
          video.removeEventListener('ended', endedHandlerRef.current);
        }
        if (errorHandlerRef.current) {
          video.removeEventListener('error', errorHandlerRef.current);
        }
      }
      endedHandlerRef.current = null;
      errorHandlerRef.current = null;
      processingCanvasRef.current = null;
      scaleFactorsRef.current = null;
    };
  }, [videoRef]);

  return {
    loadModel,
    unloadModel,
    runTracking,
    cancelTracking,
    isReady,
    isModelLoading: isPoseModelLoading,
    isModelReady: isPoseModelReady,
    modelError: poseModelError,
    backend: poseBackend,
  };
}
