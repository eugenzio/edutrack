import { useRef, useEffect } from 'react';
import { useVideoStore } from '../../stores/trackingStore';
import { useTrackingStore } from '../../stores/trackingSlice';
import { useFrameExtractor } from '../../hooks/useFrameExtractor';
import { calculateCanvasDimensions } from '../../utils/calculations';
import { useVideoRefs } from '../../contexts/VideoRefsContext';
import { TrackingOverlay } from '../Tracking/TrackingOverlay';
import { ZoneOverlay } from '../Zones/ZoneOverlay';
import { CalibrationOverlay } from '../Calibration/CalibrationOverlay';
import { DebugOverlay } from '../Tracking/DebugOverlay';
import { KnnTrainingOverlay } from '../Tracking/KnnTrainingOverlay';

export function VideoCanvas() {
  const { videoRef, canvasRef } = useVideoRefs();
  const containerRef = useRef<HTMLDivElement>(null);

  const videoUrl = useVideoStore((state) => state.videoUrl);
  const metadata = useVideoStore((state) => state.metadata);
  const playback = useVideoStore((state) => state.playback);
  const setPlaybackState = useVideoStore((state) => state.setPlaybackState);

  const trackingMethod = useTrackingStore((state) => state.config.method);
  const showDebugOverlay = useTrackingStore((state) => state.showDebugOverlay);

  // Use frame extractor hook
  useFrameExtractor({ videoRef, canvasRef });

  // Sync video playback with store
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playback.isPlaying) {
      video.play().catch((err) => {
        console.error('Playback error:', err);
        setPlaybackState({ isPlaying: false });
      });
    } else {
      video.pause();
    }
  }, [playback.isPlaying, setPlaybackState]);

  // Sync playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playback.playbackRate;
  }, [playback.playbackRate]);

  // Calculate responsive canvas dimensions
  const canvasDimensions = metadata
    ? calculateCanvasDimensions(
        metadata.width,
        metadata.height,
        1200, // max width
        800   // max height
      )
    : { width: 800, height: 600 };

  if (!videoUrl) return null;

  return (
    <div ref={containerRef} className="relative bg-black border border-gray-300">
      {/* Hidden video element (source for canvas) */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="hidden"
        playsInline
      />

      {/* Canvas wrapper with relative positioning for overlay */}
      <div
        className="relative mx-auto"
        style={{
          width: `${canvasDimensions.width}px`,
          height: `${canvasDimensions.height}px`,
        }}
      >
        {/* Canvas for rendering */}
        <canvas
          ref={canvasRef}
          width={metadata?.width || 800}
          height={metadata?.height || 600}
          style={{
            width: '100%',
            height: '100%',
          }}
          className="block"
        />

        {/* Zone overlay (drawn first, below tracking) */}
        <ZoneOverlay
          width={metadata?.width || 800}
          height={metadata?.height || 600}
        />

        {/* Calibration overlay (drawn second, above zones) */}
        <CalibrationOverlay
          width={metadata?.width || 800}
          height={metadata?.height || 600}
        />

        {/* Tracking overlay (drawn third, above calibration) */}
        <TrackingOverlay
          width={metadata?.width || 800}
          height={metadata?.height || 600}
        />

        {/* Debug overlay (drawn fourth, AI mode only, when enabled) */}
        {trackingMethod === 'ai-object' && showDebugOverlay && (
          <DebugOverlay
            width={metadata?.width || 800}
            height={metadata?.height || 600}
          />
        )}

        {/* KNN Training overlay (drawn fifth, KNN mode only, during training) */}
        {trackingMethod === 'knn-custom' && (
          <KnnTrainingOverlay
            width={metadata?.width || 800}
            height={metadata?.height || 600}
          />
        )}
      </div>

      {/* Video metadata overlay */}
      {metadata && (
        <div className="absolute top-1 left-1 bg-black/80 text-white px-1 py-0.5 text-xs font-mono">
          {metadata.width} × {metadata.height} | {Math.round(metadata.fps)} FPS
        </div>
      )}
    </div>
  );
}
