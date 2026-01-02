import { useRef, useCallback, useState, useEffect } from 'react';
import { useVideoStore } from '../stores/trackingStore';
import { useTrackingStore } from '../stores/trackingSlice';
import type { TrackingResult } from '../types';

// Processing optimization constants
const PROCESSING_WIDTH = 480; // Target width (93.75% reduction from 1920px)
const PROGRESS_THROTTLE_MS = 200; // Update progress at 5 Hz
const LOG_THROTTLE_MS = 500; // Log at 2 Hz

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

  // NEW: Optimization refs
  const backgroundGrayscaleRef = useRef<Uint8Array | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scaleFactorsRef = useRef<{ scaleX: number; scaleY: number } | null>(null);
  const lastProgressUpdateRef = useRef<number>(0);
  const lastLogTimeRef = useRef<number>(0);

  /**
   * Initialize temporary canvas for processing
   */
  useEffect(() => {
    console.log('[Mouse Tracker] Init effect:', {
      method: trackingConfig.method,
      hasMetadata: !!metadata,
      hasTempCanvas: !!tempCanvasRef.current,
      hasProcessingCanvas: !!processingCanvasRef.current
    });

    if (trackingConfig.method !== 'mouse-tracker') {
      console.log('[Mouse Tracker] Wrong method, skipping init');
      setIsReady(false);
      return;
    }

    if (!metadata) {
      console.log('[Mouse Tracker] No metadata yet');
      setIsReady(false);
      return;
    }

    // Only initialize if both canvases are null
    if (!tempCanvasRef.current || !processingCanvasRef.current) {
      console.log('[Mouse Tracker] Initializing canvases...');

      // Full-resolution canvas (for drawing video only)
      const fullResCanvas = document.createElement('canvas');
      fullResCanvas.width = metadata.width;
      fullResCanvas.height = metadata.height;
      tempCanvasRef.current = fullResCanvas;

      // Downscaled processing canvas (for pixel operations)
      const aspectRatio = metadata.height / metadata.width;
      const processingHeight = Math.round(PROCESSING_WIDTH * aspectRatio);

      const processingCanvas = document.createElement('canvas');
      processingCanvas.width = PROCESSING_WIDTH;
      processingCanvas.height = processingHeight;
      processingCanvasRef.current = processingCanvas;

      // Precompute scale factors for coordinate remapping
      scaleFactorsRef.current = {
        scaleX: metadata.width / PROCESSING_WIDTH,
        scaleY: metadata.height / processingHeight,
      };

      console.log(`[Mouse Tracker] Canvases initialized: ${PROCESSING_WIDTH}×${processingHeight} (scale: ${scaleFactorsRef.current.scaleX.toFixed(2)}×)`);

      setIsReady(true);
    } else {
      console.log('[Mouse Tracker] Canvases already exist, setting ready');
      setIsReady(true);
    }
  }, [trackingConfig.method, metadata]);

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
   * Capture reference background using Temporal Median Filtering
   * Samples 15 frames across the video and computes median per pixel
   * This automatically removes the moving mouse from the background
   */
  const captureBackground = useCallback(async () => {
    console.log('[Mouse Tracker] captureBackground called - using Temporal Median Filtering');
    const video = videoRef.current;
    const tempCanvas = tempCanvasRef.current;
    const processingCanvas = processingCanvasRef.current;

    if (!video || !metadata) {
      console.error('[Mouse Tracker] Video or metadata not ready');
      return;
    }

    if (!tempCanvas || !processingCanvas) {
      console.error('[Mouse Tracker] Canvas not ready');
      return;
    }

    const processingCtx = processingCanvas.getContext('2d', { willReadFrequently: true });
    if (!processingCtx) return;

    const { width, height } = processingCanvas;
    const pixelCount = width * height;
    const numSamples = 15;

    // Sample frames evenly across video duration
    const sampleTimes: number[] = [];
    for (let i = 0; i < numSamples; i++) {
      sampleTimes.push((video.duration * i) / (numSamples - 1));
    }

    // Collect grayscale samples
    const samples: Uint8Array[] = [];
    const originalTime = video.currentTime;
    const wasPaused = video.paused;

    console.log(`[Mouse Tracker] Sampling ${numSamples} frames for temporal median...`);

    for (let i = 0; i < numSamples; i++) {
      // Seek to sample time
      video.currentTime = sampleTimes[i];

      // Wait for seek to complete
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked, { once: true });
      });

      // Draw downscaled frame
      processingCtx.drawImage(
        video,
        0, 0, video.videoWidth, video.videoHeight,
        0, 0, width, height
      );

      // Get image data and convert to grayscale
      const imageData = processingCtx.getImageData(0, 0, width, height);
      const grayscale = toGrayscale(imageData.data);
      samples.push(grayscale);

      console.log(`[Mouse Tracker] Sampled frame ${i + 1}/${numSamples} at ${sampleTimes[i].toFixed(2)}s`);
    }

    // Compute median for each pixel
    console.log('[Mouse Tracker] Computing temporal median...');
    const medianBackground = new Uint8Array(pixelCount);

    for (let pixelIdx = 0; pixelIdx < pixelCount; pixelIdx++) {
      // Collect all values for this pixel across samples
      const values = samples.map(sample => sample[pixelIdx]);

      // Sort and take median
      values.sort((a, b) => a - b);
      medianBackground[pixelIdx] = values[Math.floor(numSamples / 2)];
    }

    // Cache the median background
    backgroundGrayscaleRef.current = medianBackground;

    // Create ImageData for storage (optional, for compatibility)
    const medianImageData = processingCtx.createImageData(width, height);
    for (let i = 0; i < pixelCount; i++) {
      const gray = medianBackground[i];
      medianImageData.data[i * 4] = gray;
      medianImageData.data[i * 4 + 1] = gray;
      medianImageData.data[i * 4 + 2] = gray;
      medianImageData.data[i * 4 + 3] = 255;
    }
    backgroundImageDataRef.current = medianImageData;

    // Create preview thumbnail
    processingCtx.putImageData(medianImageData, 0, 0);
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 160;
    previewCanvas.height = 120;
    const previewCtx = previewCanvas.getContext('2d');
    if (previewCtx) {
      previewCtx.drawImage(processingCanvas, 0, 0, 160, 120);
      setBackgroundPreview(previewCanvas.toDataURL());
    }

    // Restore original video state
    video.currentTime = originalTime;
    if (!wasPaused) {
      await video.play();
    }

    setHasBackground(true);
    console.log(`[Mouse Tracker] Temporal median background captured successfully!`);
  }, [videoRef, metadata, toGrayscale]);

  /**
   * Clear background reference
   */
  const clearBackground = useCallback(() => {
    backgroundImageDataRef.current = null;
    backgroundGrayscaleRef.current = null; // NEW: Clear cached grayscale
    setHasBackground(false);
    setBackgroundPreview(null);
    console.log('[Mouse Tracker] Background cleared');
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
   * Blob structure for connected component labeling
   */
  interface Blob {
    x: number;
    y: number;
    pixelCount: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }

  /**
   * Connected component labeling using flood-fill algorithm
   * Filters blobs by aspect ratio to remove cage structures
   */
  const findBlobs = useCallback((
    binary: Uint8Array,
    width: number,
    height: number,
    minArea: number,
    maxArea: number
  ): Blob[] => {
    const visited = new Uint8Array(binary.length);
    const blobs: Blob[] = [];

    const floodFill = (startX: number, startY: number): Blob | null => {
      const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      let minX = startX;
      let maxX = startX;
      let minY = startY;
      let maxY = startY;

      while (stack.length > 0) {
        const { x, y } = stack.pop()!;
        const idx = y * width + x;

        if (visited[idx] || binary[idx] === 0) continue;

        visited[idx] = 1;
        sumX += x;
        sumY += y;
        count++;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        // 4-connected neighbors
        if (x > 0) stack.push({ x: x - 1, y });
        if (x < width - 1) stack.push({ x: x + 1, y });
        if (y > 0) stack.push({ x, y: y - 1 });
        if (y < height - 1) stack.push({ x, y: y + 1 });
      }

      if (count === 0) return null;

      return {
        x: sumX / count,
        y: sumY / count,
        pixelCount: count,
        minX,
        maxX,
        minY,
        maxY,
      };
    };

    // Scan for blobs
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (binary[idx] > 0 && !visited[idx]) {
          const blob = floodFill(x, y);
          if (blob && blob.pixelCount >= minArea && blob.pixelCount <= maxArea) {
            // Calculate aspect ratio to filter cage structures
            const bboxWidth = blob.maxX - blob.minX + 1;
            const bboxHeight = blob.maxY - blob.minY + 1;
            const aspectRatio = Math.max(bboxWidth, bboxHeight) / Math.min(bboxWidth, bboxHeight);

            // Filter: mice are compact (aspect ratio < 5.5), cage walls are elongated
            if (aspectRatio < 5.5) {
              blobs.push(blob);
            }
          }
        }
      }
    }

    // Sort by pixel count descending
    blobs.sort((a, b) => b.pixelCount - a.pixelCount);
    return blobs;
  }, []);

  /**
   * Select best mouse blob using temporal continuity and area matching
   */
  const selectMouseBlob = useCallback((
    blobs: Blob[],
    expectedArea: number,
    prevPosition: { x: number; y: number } | null,
    maxJumpDistance: number = 120
  ): { x: number; y: number; pixelCount: number } | null => {
    if (blobs.length === 0) return null;

    // No previous position - select by area match
    if (!prevPosition) {
      let bestBlob = blobs[0];
      let minDiff = Infinity;

      for (const blob of blobs) {
        const areaDiff = Math.abs(blob.pixelCount - expectedArea);
        if (areaDiff < minDiff) {
          minDiff = areaDiff;
          bestBlob = blob;
        }
      }

      return { x: bestBlob.x, y: bestBlob.y, pixelCount: bestBlob.pixelCount };
    }

    // Temporal tracking: score by distance + area
    let bestBlob = blobs[0];
    let bestScore = Infinity;
    let foundWithinJumpDistance = false;

    for (const blob of blobs) {
      const dx = blob.x - prevPosition.x;
      const dy = blob.y - prevPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > maxJumpDistance) continue;

      foundWithinJumpDistance = true;
      const areaDiff = Math.abs(blob.pixelCount - expectedArea) / expectedArea;
      const score = distance * 0.7 + areaDiff * 100 * 0.3;

      if (score < bestScore) {
        bestScore = score;
        bestBlob = blob;
      }
    }

    // If found within jump distance, return it
    if (foundWithinJumpDistance) {
      return { x: bestBlob.x, y: bestBlob.y, pixelCount: bestBlob.pixelCount };
    }

    // Fallback: Try relaxed distance (1.5x)
    const relaxedMaxJump = maxJumpDistance * 1.5;
    bestBlob = blobs[0];
    bestScore = Infinity;

    for (const blob of blobs) {
      const dx = blob.x - prevPosition.x;
      const dy = blob.y - prevPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > relaxedMaxJump) continue;

      const areaDiff = Math.abs(blob.pixelCount - expectedArea) / expectedArea;
      const score = distance * 0.5 + areaDiff * 100 * 0.5;

      if (score < bestScore) {
        bestScore = score;
        bestBlob = blob;
      }
    }

    // Last resort: area-based selection
    if (bestScore === Infinity) {
      bestBlob = blobs[0];
      let minDiff = Infinity;

      for (const blob of blobs) {
        const areaDiff = Math.abs(blob.pixelCount - expectedArea);
        if (areaDiff < minDiff) {
          minDiff = areaDiff;
          bestBlob = blob;
        }
      }
    }

    return { x: bestBlob.x, y: bestBlob.y, pixelCount: bestBlob.pixelCount };
  }, []);

  /**
   * Process a single frame with background subtraction
   * Enhanced with blob detection and temporal tracking
   */
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const expectedAreaRef = useRef<number>(50); // Initial expected area (in downscaled coords)

  const processFrame = useCallback(
    (timestamp: number, frameNumber: number): TrackingResult | null => {
      const video = videoRef.current;
      const processingCanvas = processingCanvasRef.current;
      const backgroundGray = backgroundGrayscaleRef.current; // Use cached
      const scaleFactors = scaleFactorsRef.current;

      if (!video || !processingCanvas || !backgroundGray || !scaleFactors) {
        return null;
      }

      const ctx = processingCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      const { width, height } = processingCanvas; // Downscaled dimensions

      // Draw current frame to DOWNSCALED canvas
      ctx.drawImage(
        video,
        0, 0, video.videoWidth, video.videoHeight,
        0, 0, width, height
      );

      const currentData = ctx.getImageData(0, 0, width, height);

      // Convert ONLY current frame (background already cached)
      const currentGray = toGrayscale(currentData.data);

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

      // Scale area thresholds to match downscaled resolution
      const scaledMinArea = trackingConfig.mouseMinArea / (scaleFactors.scaleX * scaleFactors.scaleY);
      const scaledMaxArea = trackingConfig.mouseMaxArea / (scaleFactors.scaleX * scaleFactors.scaleY);

      // Find all blobs using connected component labeling
      const blobs = findBlobs(binary, width, height, scaledMinArea, scaledMaxArea);

      // Debug logging (throttled)
      if (frameNumber % 30 === 0) {
        console.log(`[Frame ${frameNumber}] Found ${blobs.length} blobs, minArea: ${scaledMinArea.toFixed(1)}, maxArea: ${scaledMaxArea.toFixed(1)}`);
        if (blobs.length > 0) {
          console.log(`  Top blob: area=${blobs[0].pixelCount.toFixed(0)}, pos=(${blobs[0].x.toFixed(0)},${blobs[0].y.toFixed(0)})`);
        }
      }

      if (blobs.length === 0) {
        return {
          frameNumber,
          timestamp,
          centerOfMass: null,
          pixelCount: 0,
          brightnessAverage: 0,
        };
      }

      // Select best mouse blob using temporal continuity
      const scaledExpectedArea = expectedAreaRef.current; // Already in downscaled coords
      const scaledMaxJump = 120 / Math.max(scaleFactors.scaleX, scaleFactors.scaleY);

      const result = selectMouseBlob(
        blobs,
        scaledExpectedArea,
        lastMousePositionRef.current,
        scaledMaxJump
      );

      if (!result) {
        return {
          frameNumber,
          timestamp,
          centerOfMass: null,
          pixelCount: 0,
          brightnessAverage: 0,
        };
      }

      // Update temporal tracking state (keep in downscaled coords)
      lastMousePositionRef.current = { x: result.x, y: result.y };
      expectedAreaRef.current = result.pixelCount; // Already in downscaled resolution

      // COORDINATE REMAPPING: Scale up to original resolution
      const originalX = result.x * scaleFactors.scaleX;
      const originalY = result.y * scaleFactors.scaleY;
      const originalPixelCount = Math.round(result.pixelCount * scaleFactors.scaleX * scaleFactors.scaleY);

      return {
        frameNumber,
        timestamp,
        centerOfMass: { x: originalX, y: originalY, timestamp },
        pixelCount: originalPixelCount,
        brightnessAverage: 0,
      };
    },
    [videoRef, trackingConfig, toGrayscale, erode, findBlobs, selectMouseBlob]
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

    // Reset temporal tracking state for new run
    lastMousePositionRef.current = null;
    // Set initial expected area to middle of min/max range (in downscaled coords)
    const scaleFactors = scaleFactorsRef.current!;
    const scaledMinArea = trackingConfig.mouseMinArea / (scaleFactors.scaleX * scaleFactors.scaleY);
    const scaledMaxArea = trackingConfig.mouseMaxArea / (scaleFactors.scaleX * scaleFactors.scaleY);
    expectedAreaRef.current = (scaledMinArea + scaledMaxArea) / 2;

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

          // THROTTLED progress and logging
          const progress = (timestamp / duration) * 100;
          const now = performance.now();

          // Update progress at most every 200ms
          if (now - lastProgressUpdateRef.current >= PROGRESS_THROTTLE_MS) {
            setTrackingProgress(progress);
            lastProgressUpdateRef.current = now;
          }

          // Log at most every 500ms
          if (now - lastLogTimeRef.current >= LOG_THROTTLE_MS) {
            console.log(`[Mouse Tracker] Processed frame ${frameNumber}/${totalFrames} (${progress.toFixed(1)}%)`);
            lastLogTimeRef.current = now;
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
      // Cancel video frame callback
      if (frameCallbackIdRef.current !== null) {
        const video = videoRef.current;
        if (video && 'cancelVideoFrameCallback' in video) {
          (video as any).cancelVideoFrameCallback(frameCallbackIdRef.current);
        }
      }

      // Clean up processing refs
      processingCanvasRef.current = null;
      backgroundGrayscaleRef.current = null;
      scaleFactorsRef.current = null;
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
