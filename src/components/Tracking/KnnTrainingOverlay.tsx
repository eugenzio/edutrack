import { useRef, useEffect, useState } from 'react';
import { useTrackingStore } from '../../stores/trackingSlice';
import { useKnnTracker } from '../../hooks/useKnnTracker';
import { useVideoRefs } from '../../contexts/VideoRefsContext';

interface KnnTrainingOverlayProps {
  width: number;
  height: number;
}

export function KnnTrainingOverlay({ width, height }: KnnTrainingOverlayProps) {
  const { videoRef, canvasRef } = useVideoRefs();
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [clickMode, setClickMode] = useState<'target' | 'background'>('target');

  const isTrainingMode = useTrackingStore((state) => state.isTrainingMode);
  const { addTrainingSample } = useKnnTracker({ videoRef, canvasRef });

  /**
   * Handle click on the overlay to add training samples
   */
  const handleClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isTrainingMode) {
      console.warn('[KNN Overlay] Click ignored - not in training mode');
      return;
    }

    const canvas = overlayRef.current;
    const videoElement = videoRef.current;
    if (!canvas || !videoElement) {
      console.error('[KNN Overlay] Canvas or video not ready');
      return;
    }

    const rect = canvas.getBoundingClientRect();

    // Calculate click position relative to canvas
    // The canvas element is scaled via CSS but the actual canvas dimensions are width x height
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;

    console.log(`[KNN Overlay] Click at client (${event.clientX}, ${event.clientY})`);
    console.log(`[KNN Overlay] Canvas coords: (${canvasX.toFixed(1)}, ${canvasY.toFixed(1)})`);
    console.log(`[KNN Overlay] Mode: ${clickMode}`);

    // Add training sample
    await addTrainingSample(canvasX, canvasY, clickMode);

    // Draw a marker at click location
    drawMarker(canvasX, canvasY, clickMode);
  };

  /**
   * Draw a marker showing where user clicked
   */
  const drawMarker = (x: number, y: number, mode: 'target' | 'background') => {
    const canvas = overlayRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw circle marker
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.strokeStyle = mode === 'target' ? '#22c55e' : '#ef4444'; // green for target, red for background
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y + 12);
    ctx.stroke();

    // Fade out after 1.5 seconds
    setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 1500);
  };

  /**
   * Handle keyboard for switching between target/background modes
   */
  useEffect(() => {
    if (!isTrainingMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 't' || event.key === 'T') {
        setClickMode('target');
      } else if (event.key === 'b' || event.key === 'B') {
        setClickMode('background');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTrainingMode]);

  if (!isTrainingMode) return null;

  return (
    <>
      {/* Overlay canvas for click handling */}
      <canvas
        ref={overlayRef}
        width={width}
        height={height}
        onClick={handleClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: 'crosshair',
          zIndex: 200, // Higher than debug overlay (100)
          pointerEvents: 'auto', // Ensure clicks are captured
        }}
      />

      {/* Mode indicator */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 201, // Above overlay canvas
          pointerEvents: 'auto', // Allow button clicks
        }}
        className="bg-black/80 text-white px-2 py-1 text-xs font-mono rounded"
      >
        <div className="flex items-center gap-2">
          <span>Mode:</span>
          <button
            onClick={() => setClickMode('target')}
            className={`px-2 py-0.5 rounded ${
              clickMode === 'target'
                ? 'bg-green-600 text-white'
                : 'bg-gray-600 text-gray-300'
            }`}
          >
            Target (T)
          </button>
          <button
            onClick={() => setClickMode('background')}
            className={`px-2 py-0.5 rounded ${
              clickMode === 'background'
                ? 'bg-red-600 text-white'
                : 'bg-gray-600 text-gray-300'
            }`}
          >
            Background (B)
          </button>
        </div>
      </div>
    </>
  );
}
