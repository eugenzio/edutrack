import { useRef, useEffect } from 'react';
import { useVideoStore } from '../../stores/trackingStore';
import { useTrackingStore } from '../../stores/trackingSlice';
import { useFrameExtractor } from '../../hooks/useFrameExtractor';
import { calculateCanvasDimensions } from '../../utils/calculations';
import { useVideoRefs } from '../../contexts/VideoRefsContext';
import { TrackingOverlay } from '../Tracking/TrackingOverlay';
import { ZoneOverlay } from '../Zones/ZoneOverlay';
import { CalibrationOverlay } from '../Calibration/CalibrationOverlay';

export function VideoCanvas() {
  const { videoRef, canvasRef } = useVideoRefs();
  const containerRef = useRef<HTMLDivElement>(null);

  const videoUrl = useVideoStore((state) => state.videoUrl);
  const metadata = useVideoStore((state) => state.metadata);
  const playback = useVideoStore((state) => state.playback);
  const setPlaybackState = useVideoStore((state) => state.setPlaybackState);

  const isTracking = useTrackingStore((state) => state.isTracking);
  const trackingProgress = useTrackingStore((state) => state.trackingProgress);
  const trackingMethod = useTrackingStore((state) => state.config.method);
  const trackingResults = useTrackingStore((state) => state.results);

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
          results={trackingResults}
          currentFrameIndex={Math.floor(playback.currentTime * (metadata?.fps || 30))}
          videoRef={videoRef}
        />

        {/* Processing overlay (shown during tracking) */}
        {isTracking && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 300, // Above all overlays
              pointerEvents: 'none',
            }}
          >
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="animate-spin">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Processing Video</h3>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Progress</span>
                  <span className="font-mono font-semibold">{trackingProgress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${trackingProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Analyzing frames with {trackingMethod === 'mouse-tracker' ? 'background subtraction' : 'brightness threshold'}...
                </p>
              </div>
            </div>
          </div>
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
