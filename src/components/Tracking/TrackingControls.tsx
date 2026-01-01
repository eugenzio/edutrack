import { useTrackingStore } from '../../stores/trackingSlice';
import { useColorTracker } from '../../hooks/useColorTracker';
import { useMouseTracker } from '../../hooks/useMouseTracker';
import { useVideoStore } from '../../stores/trackingStore';
import { useVideoRefs } from '../../contexts/VideoRefsContext';

export function TrackingControls() {
  const { videoRef, canvasRef } = useVideoRefs();
  const isVideoLoaded = useVideoStore((state) => state.isVideoLoaded());
  const isTracking = useTrackingStore((state) => state.isTracking);
  const trackingProgress = useTrackingStore((state) => state.trackingProgress);
  const config = useTrackingStore((state) => state.config);
  const updateConfig = useTrackingStore((state) => state.updateConfig);
  const resetTracking = useTrackingStore((state) => state.resetTracking);
  const hasData = useTrackingStore((state) => state.hasTrackingData());
  const error = useTrackingStore((state) => state.error);

  // IMPORTANT: Always call all hooks unconditionally (React Hooks rule)
  const brightnessTracker = useColorTracker({ videoRef, canvasRef });
  const mouseTracker = useMouseTracker({ videoRef, canvasRef });

  if (!isVideoLoaded) return null;

  const handleBrightnessChange = (value: number) => {
    updateConfig({ brightnessThreshold: value });
  };

  const handleMinPixelChange = (value: number) => {
    updateConfig({ minPixelCount: value });
  };

  const handleStartTracking = () => {
    console.log(`[TrackingControls] Starting tracking with method: ${config.method}`);

    if (config.method === 'mouse-tracker') {
      console.log('[TrackingControls] Running mouse tracker...');
      mouseTracker.runTracking();
    } else {
      console.log('[TrackingControls] Running brightness tracking...');
      brightnessTracker.runTracking();
    }
  };

  const handleStopTracking = () => {
    console.log(`[TrackingControls] Stopping tracking with method: ${config.method}`);

    if (config.method === 'mouse-tracker') {
      mouseTracker.cancelTracking();
    } else {
      brightnessTracker.cancelTracking();
    }
  };

  const isStartDisabled =
    isTracking ||
    (config.method === 'mouse-tracker' && !mouseTracker.hasBackground);

  return (
    <div className="border border-gray-300 bg-white">
      <div className="px-2 py-1 bg-gray-200 border-b border-gray-300 text-xs font-semibold">
        🐭 Mouse Tracker
      </div>

      <div className="p-2 space-y-2">
        {/* Method Selector */}
        <div className="flex gap-1 border-b border-gray-300 pb-2">
          <button
            onClick={() => updateConfig({ method: 'mouse-tracker' })}
            disabled={isTracking}
            className={`flex-1 px-2 py-1 text-xs ${
              config.method === 'mouse-tracker'
                ? 'bg-gray-700 text-white border border-gray-600'
                : 'bg-gray-100 text-gray-800 border border-gray-400 hover:bg-gray-200'
            }`}
          >
            Background Subtraction
          </button>
          <button
            onClick={() => updateConfig({ method: 'brightness' })}
            disabled={isTracking}
            className={`flex-1 px-2 py-1 text-xs ${
              config.method === 'brightness'
                ? 'bg-gray-700 text-white border border-gray-600'
                : 'bg-gray-100 text-gray-800 border border-gray-400 hover:bg-gray-200'
            }`}
          >
            Brightness (Legacy)
          </button>
        </div>

        {/* Mouse Tracker Panel */}
        {config.method === 'mouse-tracker' && (
          <>
            {/* Instructions */}
            <div className="text-xs bg-blue-50 border border-blue-600 p-1.5">
              <p className="font-semibold text-blue-900 mb-1">Quick Start:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
                <li>Seek to an empty cage frame (no mouse visible)</li>
                <li>Click "Capture Background" below</li>
                <li>Adjust threshold and filters if needed</li>
                <li>Click "Start Tracking" to analyze the video</li>
              </ol>
            </div>

            {/* Background Capture */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700">
                  1. Reference Background
                </label>
                {mouseTracker.hasBackground && (
                  <span className="text-xs text-green-700 font-semibold">✓ Captured</span>
                )}
              </div>

              <div className="flex gap-1">
                <button
                  onClick={mouseTracker.captureBackground}
                  disabled={isTracking || !mouseTracker.isReady}
                  className="flex-1 px-2 py-1 border border-green-700 bg-green-600 hover:bg-green-500 text-white text-xs disabled:opacity-50"
                >
                  {mouseTracker.hasBackground ? 'Re-capture Background' : 'Capture Background'}
                </button>
                {mouseTracker.hasBackground && (
                  <button
                    onClick={mouseTracker.clearBackground}
                    disabled={isTracking}
                    className="px-2 py-1 border border-red-700 bg-red-600 hover:bg-red-500 text-white text-xs disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Background Preview */}
              {mouseTracker.backgroundPreview && (
                <div className="mt-1">
                  <img
                    src={mouseTracker.backgroundPreview}
                    alt="Background reference"
                    className="w-full h-auto border border-gray-400 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-0.5 text-center">
                    Background reference frame
                  </p>
                </div>
              )}
            </div>

            {/* Threshold Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">2. Difference Threshold</label>
                <span className="text-xs font-mono text-gray-800">{config.mouseThreshold}</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={config.mouseThreshold}
                onChange={(e) => updateConfig({ mouseThreshold: Number(e.target.value) })}
                disabled={isTracking}
                className="w-full h-1 bg-gray-300 appearance-none cursor-pointer disabled:opacity-50"
              />
              <p className="text-xs text-gray-500">
                Higher = less sensitive to lighting changes. Start with 20-40.
              </p>
            </div>

            {/* Min Area Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">3. Minimum Area (px)</label>
                <span className="text-xs font-mono text-gray-800">{config.mouseMinArea}</span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={config.mouseMinArea}
                onChange={(e) => updateConfig({ mouseMinArea: Number(e.target.value) })}
                disabled={isTracking}
                className="w-full h-1 bg-gray-300 appearance-none cursor-pointer disabled:opacity-50"
              />
              <p className="text-xs text-gray-500">
                Filter out small noise (bedding, feces). Typical mouse = 200-400px.
              </p>
            </div>

            {/* Invert Toggle */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={config.mouseInvert}
                  onChange={(e) => updateConfig({ mouseInvert: e.target.checked })}
                  disabled={isTracking}
                  className="w-3 h-3 disabled:opacity-50"
                />
                <span className="flex-1">Invert Mask (for black mice on light background)</span>
              </label>
            </div>

            {/* Erosion Toggle */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={config.mouseErosion}
                  onChange={(e) => updateConfig({ mouseErosion: e.target.checked })}
                  disabled={isTracking}
                  className="w-3 h-3 disabled:opacity-50"
                />
                <span className="flex-1">Tail Rejection (erosion to focus on body)</span>
              </label>
              <p className="text-xs text-gray-500 ml-5">
                Removes thin structures like tails to reduce jitter. Use if tail causes tracking issues.
              </p>
            </div>
          </>
        )}

        {/* Brightness Panel (Legacy) */}
        {config.method === 'brightness' && (
          <>
            <div className="text-xs bg-yellow-50 border border-yellow-600 p-1.5">
              <p className="text-yellow-900">
                <strong>Legacy Mode:</strong> Uses simple brightness thresholding.
                For rodents, "Background Subtraction" is recommended.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">Brightness Threshold</label>
                <span className="text-xs font-mono text-gray-800">
                  {config.brightnessThreshold}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={config.brightnessThreshold}
                onChange={(e) => handleBrightnessChange(Number(e.target.value))}
                disabled={isTracking}
                className="w-full h-1 bg-gray-300 appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">Min Pixel Count</label>
                <span className="text-xs font-mono text-gray-800">
                  {config.minPixelCount}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={config.minPixelCount}
                onChange={(e) => handleMinPixelChange(Number(e.target.value))}
                disabled={isTracking}
                className="w-full h-1 bg-gray-300 appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>
          </>
        )}

        {/* Frame Sampling */}
        <div className="space-y-1 border-t border-gray-300 pt-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-gray-600">Sample Every Nth Frame</label>
            <span className="text-xs font-mono text-gray-800">
              {config.sampleEveryNthFrame}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={config.sampleEveryNthFrame}
            onChange={(e) => updateConfig({ sampleEveryNthFrame: Number(e.target.value) })}
            disabled={isTracking}
            className="w-full h-1 bg-gray-300 appearance-none cursor-pointer disabled:opacity-50"
          />
          <p className="text-xs text-gray-500">
            Higher = faster processing but lower temporal resolution. 1 = every frame.
          </p>
        </div>

        {/* Tracking Controls */}
        <div className="flex gap-1 border-t border-gray-300 pt-2">
          {!isTracking ? (
            <button
              onClick={handleStartTracking}
              disabled={isStartDisabled}
              className="flex-1 px-2 py-1.5 border border-green-700 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {config.method === 'mouse-tracker' && !mouseTracker.hasBackground
                ? 'Capture Background First'
                : 'Start Tracking'}
            </button>
          ) : (
            <>
              <button
                onClick={handleStopTracking}
                className="flex-1 px-2 py-1.5 border border-red-700 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
              >
                Stop Tracking
              </button>
              <div className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-sm font-semibold text-center">
                {trackingProgress.toFixed(1)}%
              </div>
            </>
          )}
        </div>

        {hasData && !isTracking && (
          <button
            onClick={resetTracking}
            className="w-full px-2 py-1 border border-gray-600 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs"
          >
            Reset Tracking Data
          </button>
        )}

        {/* Error Display */}
        {error && (
          <div className="text-xs text-red-800 bg-red-50 border border-red-600 p-1">
            {error}
          </div>
        )}

        {/* Performance Info */}
        {config.method === 'mouse-tracker' && (
          <div className="text-xs bg-gray-50 border border-gray-400 p-1.5 mt-2">
            <p className="font-semibold text-gray-700 mb-1">📊 Algorithm Details:</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-600">
              <li><strong>Method:</strong> Background Subtraction (Frame Differencing)</li>
              <li><strong>Processing:</strong> Grayscale conversion (4x faster than RGB)</li>
              <li><strong>Blob Detection:</strong> Center of Mass calculation</li>
              <li><strong>Real-time:</strong> Uses requestVideoFrameCallback (30-60 FPS)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
