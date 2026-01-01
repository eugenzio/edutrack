import { useRef, useCallback, useState, useEffect } from 'react';
import { useVideoStore } from '../stores/trackingStore';
import { useTrackingStore } from '../stores/trackingSlice';
import type { TrackingResult } from '../types';

interface UseMouseTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

/**
 * High-performance mouse/rodent tracker using Background Subtraction
 * Optimized for ethology research (Open Field Test, etc.)
 */
export function useMouseTracker({ videoRef }: UseMouseTrackerProps) {
  const metadata = useVideoStore((state) => state.metadata);
  const trackingConfig = useTrackingStore((state) => state.config);
  const startTracking = useTrackingStore((state) => state.startTracking);
  const stopTracking = useTrackingStore((state) => state.stopTracking);
  const setTrackingProgress = useTrackingStore((state) => state.setTrackingProgress);
  const setTrackingResults = useTrackingStore((state) => state.setTrackingResults);
  const setTrackingError = useTrackingStore((state) => state.setTrackingError);

  const [isReady, setIsReady] = useState(false);
  const [hasBackground, setHasBackground] = useState(false);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);

  const isTrackingRef = useRef(false);
  const frameCallbackIdRef = useRef<number | null>(null);
  const backgroundImageDataRef = useRef<ImageData | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * Initialize temporary canvas for processing
   */
  useEffect(() => {
    if (trackingConfig.method !== 'mouse-tracker') {
      return;
    }

    if (!tempCanvasRef.current && metadata) {
      const canvas = document.createElement('canvas');
      canvas.width = metadata.width;
      canvas.height = metadata.height;
      tempCanvasRef.current = canvas;
      setIsReady(true);
    }
  }, [trackingConfig.method, metadata]);

  /**
   * Capture reference background frame (empty cage)
   */
  const captureBackground = useCallback(() => {
    const video = videoRef.current;
    const tempCanvas = tempCanvasRef.current;

    if (!video || !tempCanvas) {
      console.error('[Mouse Tracker] Video or canvas not ready');
      return;
    }

    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Draw current frame to temp canvas
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    // Get image data
    backgroundImageDataRef.current = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    // Create preview thumbnail
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 160;
    previewCanvas.height = 120;
    const previewCtx = previewCanvas.getContext('2d');
    if (previewCtx) {
      previewCtx.drawImage(tempCanvas, 0, 0, 160, 120);
      setBackgroundPreview(previewCanvas.toDataURL());
    }

    setHasBackground(true);
    console.log('[Mouse Tracker] Background captured');
  }, [videoRef]);

  /**
   * Clear background reference
   */
  const clearBackground = useCallback(() => {
    backgroundImageDataRef.current = null;
    setHasBackground(false);
    setBackgroundPreview(null);
    console.log('[Mouse Tracker] Background cleared');
  }, []);

  /**
   * Convert RGB to grayscale (Y = 0.299*R + 0.587*G + 0.114*B)
   * This is 4x faster than processing RGB channels
   */
  const toGrayscale = useCallback((data: Uint8ClampedArray): Uint8Array => {
    const len = data.length;
    const gray = new Uint8Array(len / 4);

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    return gray;
  }, []);

  /**
   * Morphological erosion to remove thin structures (tail)
   * Uses 3x3 cross-shaped structuring element
   */
  const erode = useCallback((
    binary: Uint8Array,
    width: number,
    height: number
  ): Uint8Array => {
    const eroded = new Uint8Array(binary.length);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // Check 3x3 cross (center + 4-connected neighbors)
        const center = binary[idx];
        const top = binary[(y - 1) * width + x];
        const bottom = binary[(y + 1) * width + x];
        const left = binary[y * width + (x - 1)];
        const right = binary[y * width + (x + 1)];

        // Erode: keep pixel only if all neighbors are foreground
        eroded[idx] = (center && top && bottom && left && right) ? 255 : 0;
      }
    }

    return eroded;
  }, []);

  /**
   * Calculate center of mass (centroid) from binary mask
   * This is more accurate than bounding box center for stretching mice
   */
  const calculateCenterOfMass = useCallback((
    binary: Uint8Array,
    width: number,
    height: number
  ): { x: number; y: number; pixelCount: number } | null => {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (binary[idx] > 0) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    if (count === 0) return null;

    return {
      x: sumX / count,
      y: sumY / count,
      pixelCount: count,
    };
  }, []);

  /**
   * Process a single frame with background subtraction
   */
  const processFrame = useCallback(
    (timestamp: number, frameNumber: number): TrackingResult | null => {
      const video = videoRef.current;
      const tempCanvas = tempCanvasRef.current;
      const backgroundData = backgroundImageDataRef.current;

      if (!video || !tempCanvas || !backgroundData) {
        return null;
      }

      const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      const { width, height } = tempCanvas;

      // Draw current frame
      ctx.drawImage(video, 0, 0, width, height);
      const currentData = ctx.getImageData(0, 0, width, height);

      // Convert both frames to grayscale (4x speedup)
      const currentGray = toGrayscale(currentData.data);
      const backgroundGray = toGrayscale(backgroundData.data);

      // Background subtraction: |Current - Background|
      const diff = new Uint8Array(currentGray.length);
      const threshold = trackingConfig.mouseThreshold;
      const invert = trackingConfig.mouseInvert;

      for (let i = 0; i < currentGray.length; i++) {
        const absDiff = Math.abs(currentGray[i] - backgroundGray[i]);

        // Apply threshold
        if (absDiff > threshold) {
          diff[i] = invert ? 0 : 255;
        } else {
          diff[i] = invert ? 255 : 0;
        }
      }

      // Optional: Morphological erosion to remove tail
      let binary: Uint8Array = diff;
      if (trackingConfig.mouseErosion) {
        binary = erode(diff, width, height);
      }

      // Calculate center of mass
      const result = calculateCenterOfMass(binary, width, height);

      // Filter by minimum area
      if (!result || result.pixelCount < trackingConfig.mouseMinArea) {
        return {
          frameNumber,
          timestamp,
          centerOfMass: null,
          pixelCount: 0,
          brightnessAverage: 0,
        };
      }

      return {
        frameNumber,
        timestamp,
        centerOfMass: { x: result.x, y: result.y, timestamp },
        pixelCount: result.pixelCount,
        brightnessAverage: 0,
      };
    },
    [videoRef, trackingConfig, toGrayscale, erode, calculateCenterOfMass]
  );

  /**
   * Run real-time tracking using requestVideoFrameCallback
   */
  const runTracking = useCallback(async () => {
    console.log('[Mouse Tracker] Starting background subtraction tracking...');

    const video = videoRef.current;

    if (!video || !metadata || !backgroundImageDataRef.current) {
      const errorMsg = 'Video, metadata, or background not ready';
      console.error('[Mouse Tracker] Cannot start:', errorMsg);
      setTrackingError(errorMsg);
      return;
    }

    // Check if browser supports rVFC
    if (!('requestVideoFrameCallback' in video)) {
      const errorMsg = 'Browser does not support requestVideoFrameCallback';
      console.error('[Mouse Tracker]', errorMsg);
      setTrackingError(errorMsg);
      return;
    }

    console.log('[Mouse Tracker] All prerequisites met. Starting tracking loop...');

    // Initialize tracking state
    startTracking();
    isTrackingRef.current = true;

    const { duration, fps } = metadata;
    const sampleStep = trackingConfig.sampleEveryNthFrame;
    const totalFrames = Math.floor(duration * fps);
    const results: TrackingResult[] = [];

    let frameCount = 0;
    let lastProcessedFrame = -sampleStep;

    // Save original playback rate
    const originalRate = video.playbackRate;

    try {
      // Set playback rate for analysis
      video.playbackRate = 1.0;

      // Seek to start
      video.currentTime = 0;

      // Wait for seek to complete
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked, { once: true });
      });

      // Start playback
      await video.play();

      // rVFC frame processor
      const processVideoFrame = async () => {
        // Check if tracking was cancelled
        if (!isTrackingRef.current) {
          console.log('[Mouse Tracker] Tracking cancelled');
          video.pause();
          return;
        }

        // Check if we've reached the end
        if (video.currentTime >= duration || video.ended) {
          console.log('[Mouse Tracker] Reached end of video');
          video.pause();
          setTrackingResults(results);
          setTrackingProgress(100);
          stopTracking();
          isTrackingRef.current = false;
          return;
        }

        frameCount++;

        // Sample every Nth frame
        if (frameCount - lastProcessedFrame >= sampleStep) {
          lastProcessedFrame = frameCount;

          const timestamp = video.currentTime;
          const frameNumber = Math.floor(timestamp * fps);

          // Process frame (FAST - no async AI inference)
          const result = processFrame(timestamp, frameNumber);
          if (result) {
            results.push(result);
          }

          // Update progress
          const progress = (timestamp / duration) * 100;
          setTrackingProgress(progress);

          if (frameCount % 30 === 0) {
            console.log(`[Mouse Tracker] Processed frame ${frameNumber}/${totalFrames} (${progress.toFixed(1)}%)`);
          }
        }

        // Continue to next frame if still tracking
        if (isTrackingRef.current && !video.ended) {
          frameCallbackIdRef.current = (video as any).requestVideoFrameCallback(processVideoFrame);
        } else {
          // Tracking completed
          video.pause();
          setTrackingResults(results);
          setTrackingProgress(100);
          stopTracking();
          isTrackingRef.current = false;
        }
      };

      // Start rVFC loop
      frameCallbackIdRef.current = (video as any).requestVideoFrameCallback(processVideoFrame);

    } catch (error) {
      console.error('[Mouse Tracker] Tracking error:', error);
      setTrackingError(error instanceof Error ? error.message : 'Unknown error');
      video.pause();
    } finally {
      // Restore original playback rate
      video.playbackRate = originalRate;
      isTrackingRef.current = false;
      frameCallbackIdRef.current = null;
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
   * Cancel ongoing tracking
   */
  const cancelTracking = useCallback(() => {
    console.log('[Mouse Tracker] Cancelling tracking...');
    isTrackingRef.current = false;

    // Cancel rVFC
    const video = videoRef.current;
    if (video && frameCallbackIdRef.current !== null && 'cancelVideoFrameCallback' in video) {
      (video as any).cancelVideoFrameCallback(frameCallbackIdRef.current);
      frameCallbackIdRef.current = null;
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
    };
  }, [videoRef]);

  return {
    runTracking,
    cancelTracking,
    captureBackground,
    clearBackground,
    isReady,
    hasBackground,
    backgroundPreview,
  };
}
