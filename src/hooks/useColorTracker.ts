import { useRef, useCallback } from 'react';
import { useVideoStore } from '../stores/trackingStore';
import { useTrackingStore } from '../stores/trackingSlice';
import { detectBrightObjects } from '../utils/colorDetection';
import type { TrackingResult } from '../types';

interface UseColorTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function useColorTracker({ videoRef, canvasRef }: UseColorTrackerProps) {
  const metadata = useVideoStore((state) => state.metadata);
  const trackingConfig = useTrackingStore((state) => state.config);
  const startTracking = useTrackingStore((state) => state.startTracking);
  const stopTracking = useTrackingStore((state) => state.stopTracking);
  const setTrackingProgress = useTrackingStore((state) => state.setTrackingProgress);
  const setTrackingResults = useTrackingStore((state) => state.setTrackingResults);
  const setTrackingError = useTrackingStore((state) => state.setTrackingError);

  const isTrackingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Process a single frame and return tracking result
   */
  const processFrame = useCallback(
    (frameNumber: number, timestamp: number): TrackingResult | null => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) return null;

      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
      if (!ctx) return null;

      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Extract image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Detect bright objects
      const detection = detectBrightObjects(imageData, {
        brightnessThreshold: trackingConfig.brightnessThreshold,
        minPixelCount: trackingConfig.minPixelCount,
      });

      // Set frame metadata
      const result: TrackingResult = {
        frameNumber,
        timestamp,
        centerOfMass: detection.centerOfMass
          ? { ...detection.centerOfMass, timestamp }
          : null,
        pixelCount: detection.pixelCount,
        brightnessAverage: detection.brightnessAverage,
      };

      return result;
    },
    [videoRef, canvasRef, trackingConfig]
  );

  /**
   * Run tracking on entire video
   */
  const runTracking = useCallback(async () => {
    console.log('[Brightness Tracking] Starting brightness-based tracking...');

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !metadata) {
      const errorMsg = 'Video not loaded';
      console.error('[Brightness Tracking] Cannot start:', errorMsg);
      setTrackingError(errorMsg);
      return;
    }

    console.log('[Brightness Tracking] All prerequisites met. Starting tracking loop...');
    console.log(`[Brightness Tracking] Threshold: ${trackingConfig.brightnessThreshold}, Min pixels: ${trackingConfig.minPixelCount}`);

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

          // Timeout after 5 seconds
          setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            reject(new Error('Seek timeout'));
          }, 5000);
        });

        // Process frame
        const result = processFrame(frameNumber, timestamp);
        if (result) {
          results.push(result);
        }

        // Update progress
        const progress = ((frameNumber + sampleStep) / totalFrames) * 100;
        setTrackingProgress(progress);

        // Yield to browser (prevent UI freezing)
        if (frameNumber % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Save results
      setTrackingResults(results);
      setTrackingProgress(100);
      stopTracking();

      console.log(`[Brightness Tracking] Complete: ${results.length} frames processed`);
    } catch (error) {
      console.error('[Brightness Tracking] Error:', error);
      setTrackingError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      isTrackingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [
    videoRef,
    canvasRef,
    metadata,
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
  };
}
