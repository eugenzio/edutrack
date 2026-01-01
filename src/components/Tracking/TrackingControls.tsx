import { useTrackingStore } from '../../stores/trackingSlice';
import { useColorTracker } from '../../hooks/useColorTracker';
import { useAiTracker } from '../../hooks/useAiTracker';
import { useKnnTracker } from '../../hooks/useKnnTracker';
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

  // AI-specific state
  const isModelLoading = useTrackingStore((state) => state.isModelLoading);
  const modelError = useTrackingStore((state) => state.modelError);
  const detectedClasses = useTrackingStore((state) => state.detectedClasses);
  const lastAiBoxSource = useTrackingStore((state) => state.lastAiBoxSource);
  const lostCount = useTrackingStore((state) => state.lostCount);
  const clearAiLock = useTrackingStore((state) => state.clearAiLock);
  const showDebugOverlay = useTrackingStore((state) => state.showDebugOverlay);
  const setShowDebugOverlay = useTrackingStore((state) => state.setShowDebugOverlay);
  const isScanningFrame = useTrackingStore((state) => state.isScanningFrame);
  const scanError = useTrackingStore((state) => state.scanError);
  const lastScanSummary = useTrackingStore((state) => state.lastScanSummary);
  const isLivePreview = useTrackingStore((state) => state.isLivePreview);
  const setIsLivePreview = useTrackingStore((state) => state.setIsLivePreview);

  // IMPORTANT: Always call all hooks unconditionally (React Hooks rule)
  // But they will only execute heavy operations when their method is active
  const brightnessTracker = useColorTracker({ videoRef, canvasRef });
  const aiTracker = useAiTracker({ videoRef, canvasRef });
  const knnTracker = useKnnTracker({ videoRef, canvasRef });

  if (!isVideoLoaded) return null;

  const handleBrightnessChange = (value: number) => {
    updateConfig({ brightnessThreshold: value });
  };

  const handleMinPixelChange = (value: number) => {
    updateConfig({ minPixelCount: value });
  };

  const handleStartTracking = () => {
    console.log(`[TrackingControls] Starting tracking with method: ${config.method}`);

    if (config.method === 'ai-object') {
      console.log('[TrackingControls] Running AI tracking...');
      aiTracker.runTracking();
    } else if (config.method === 'knn-custom') {
      console.log('[TrackingControls] Running KNN tracking...');
      knnTracker.runTracking();
    } else {
      console.log('[TrackingControls] Running brightness tracking...');
      brightnessTracker.runTracking();
    }
  };

  const handleStopTracking = () => {
    console.log(`[TrackingControls] Stopping tracking with method: ${config.method}`);

    if (config.method === 'ai-object') {
      aiTracker.cancelTracking();
    } else if (config.method === 'knn-custom') {
      knnTracker.cancelTracking();
    } else {
      brightnessTracker.cancelTracking();
    }
  };

  const handleScanFrame = () => {
    aiTracker.warmupDetection();
  };

  const isStartDisabled =
    isTracking ||
    (config.method === 'ai-object' && (!config.aiTargetClass || !aiTracker.isModelReady)) ||
    (config.method === 'knn-custom' && (!knnTracker.knnReady || !knnTracker.isModelReady));

  return (
    <div className="border border-gray-300 bg-white">
      <div className="px-2 py-1 bg-gray-200 border-b border-gray-300 text-xs font-semibold">
        Tracking
      </div>

      <div className="p-2 space-y-2">
        {/* Method Selector */}
        <div className="flex gap-1 border-b border-gray-300 pb-2">
          <button
            onClick={() => updateConfig({ method: 'ai-object' })}
            disabled={isTracking}
            className={`flex-1 px-2 py-1 text-xs ${
              config.method === 'ai-object'
                ? 'bg-gray-700 text-white border border-gray-600'
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            } disabled:opacity-50`}
          >
            AI Object
          </button>
          <button
            onClick={() => updateConfig({ method: 'knn-custom' })}
            disabled={isTracking}
            className={`flex-1 px-2 py-1 text-xs ${
              config.method === 'knn-custom'
                ? 'bg-gray-700 text-white border border-gray-600'
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            } disabled:opacity-50`}
          >
            Custom Train
          </button>
          <button
            onClick={() => updateConfig({ method: 'brightness' })}
            disabled={isTracking}
            className={`flex-1 px-2 py-1 text-xs ${
              config.method === 'brightness'
                ? 'bg-gray-700 text-white border border-gray-600'
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            } disabled:opacity-50`}
          >
            Brightness
          </button>
        </div>

        {/* AI Panel */}
        {config.method === 'ai-object' && (
          <>
            {/* Model Status */}
            {isModelLoading && (
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-600 p-1">
                Loading AI model...
              </div>
            )}
            {modelError && (
              <div className="text-xs text-red-800 bg-red-50 border border-red-600 p-1">
                Model Error: {modelError}
              </div>
            )}

            {/* Confidence Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">Confidence</label>
                <span className="text-xs font-mono text-gray-800">
                  {(config.aiConfidence * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.aiConfidence * 100}
                onChange={(e) => updateConfig({ aiConfidence: Number(e.target.value) / 100 })}
                disabled={isTracking}
                className="w-full h-1 bg-gray-300 appearance-none cursor-pointer disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                If nothing is detected, lower Confidence (0.3–0.5) and scan again.
              </p>
            </div>

            {/* Scan Frame Button */}
            <button
              onClick={handleScanFrame}
              disabled={isTracking || isScanningFrame}
              className="w-full px-2 py-1 border border-gray-400 bg-gray-100 hover:bg-gray-200 text-xs disabled:opacity-50"
            >
              {isScanningFrame ? 'Scanning...' : isModelLoading ? 'Loading Model...' : 'Scan Frame'}
            </button>

            {/* Scan Status */}
            {isScanningFrame && (
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-600 p-1">
                Scanning current frame...
              </div>
            )}
            {!isScanningFrame && scanError && (
              <div className="text-xs text-orange-700 bg-orange-50 border border-orange-600 p-1">
                {scanError}
              </div>
            )}
            {!isScanningFrame && !scanError && lastScanSummary && (
              <div className="text-xs text-gray-700 bg-gray-50 border border-gray-400 p-1.5 space-y-0.5">
                <div className="font-semibold">Last Scan Results:</div>
                <div className="grid grid-cols-2 gap-x-2">
                  <span>Raw predictions:</span>
                  <span className="font-mono">{lastScanSummary.rawPredictions}</span>
                  <span>Filtered detections:</span>
                  <span className="font-mono">{lastScanSummary.filteredDetections}</span>
                  <span>Max score:</span>
                  <span className="font-mono">{(lastScanSummary.maxScore * 100).toFixed(1)}%</span>
                </div>
                {lastScanSummary.topClasses.length > 0 && (
                  <div className="pt-0.5">
                    <div className="font-semibold">Top classes:</div>
                    <div className="text-xs">
                      {lastScanSummary.topClasses.map((tc, i) => (
                        <div key={i} className="font-mono">
                          {tc.cls} ({(tc.score * 100).toFixed(1)}%)
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Target Class Dropdown */}
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Target Class</label>
              <select
                value={config.aiTargetClass || ''}
                onChange={(e) => updateConfig({ aiTargetClass: e.target.value || null })}
                disabled={isTracking || detectedClasses.length === 0}
                className="w-full px-2 py-1 text-xs border border-gray-300 disabled:opacity-50"
              >
                <option value="">Select class...</option>
                {detectedClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
              {!config.aiTargetClass && detectedClasses.length === 0 && (
                <p className="text-xs text-orange-700 bg-orange-50 border border-orange-600 p-1 mt-1">
                  Scan or enable Live Preview to discover classes, then select a Target Class.
                </p>
              )}
              {!config.aiTargetClass && detectedClasses.length > 0 && (
                <p className="text-xs text-orange-700 bg-orange-50 border border-orange-600 p-1 mt-1">
                  Select a Target Class to enable tracking.
                </p>
              )}
            </div>

            {/* Lock Status */}
            {lastAiBoxSource === 'user' && (
              <div className="flex items-center justify-between text-xs bg-yellow-50 border border-yellow-600 p-1">
                <span className="font-semibold text-yellow-800">LOCKED</span>
                <button
                  onClick={clearAiLock}
                  className="px-1 py-0.5 border border-yellow-700 bg-yellow-100 hover:bg-yellow-200"
                >
                  Unlock
                </button>
              </div>
            )}

            {/* Lost Frame Counter */}
            {lostCount > 0 && (
              <div className="text-xs text-orange-700 bg-orange-50 border border-orange-600 p-1">
                Lost for {lostCount} frame{lostCount > 1 ? 's' : ''}
              </div>
            )}

            {/* Strategy Selector */}
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Tracking Strategy</label>
              <select
                value={config.aiTrackStrategy}
                onChange={(e) => updateConfig({ aiTrackStrategy: e.target.value as any })}
                disabled={isTracking}
                className="w-full px-2 py-1 text-xs border border-gray-300 disabled:opacity-50"
              >
                <option value="nearestPrev">Nearest to Previous</option>
                <option value="highestScore">Highest Score</option>
                <option value="largest">Largest</option>
              </select>
            </div>

            {/* Live Preview Toggle */}
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={isLivePreview}
                onChange={(e) => setIsLivePreview(e.target.checked)}
                disabled={!aiTracker.isModelReady}
                className="w-3 h-3 disabled:opacity-50"
              />
              Live Preview (while playing)
            </label>

            {/* Debug Overlay Toggle */}
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={showDebugOverlay}
                onChange={(e) => setShowDebugOverlay(e.target.checked)}
                className="w-3 h-3"
              />
              Show Debug Overlay
            </label>
          </>
        )}

        {/* KNN Custom Train Panel */}
        {config.method === 'knn-custom' && (
          <>
            {/* Model Status */}
            {isModelLoading && (
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-600 p-1">
                Loading KNN models...
              </div>
            )}
            {modelError && (
              <div className="text-xs text-red-800 bg-red-50 border border-red-600 p-1">
                Model Error: {modelError}
              </div>
            )}

            {/* Training Instructions */}
            <div className="text-xs bg-blue-50 border border-blue-600 p-1.5">
              <div className="font-semibold mb-1">Training Instructions:</div>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Click "Start Training" below</li>
                <li>Click on the animal/object (target)</li>
                <li>Click on empty areas (background)</li>
                <li>Collect 5-10 samples of each</li>
                <li>Click "Done Training" when ready</li>
              </ol>
            </div>

            {/* Training Button */}
            {!knnTracker.isTrainingMode ? (
              <button
                onClick={() => knnTracker.startTraining()}
                disabled={!knnTracker.isModelReady || isTracking}
                className="w-full px-2 py-1 border border-gray-600 bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50"
              >
                {knnTracker.isModelReady ? 'Start Training' : 'Loading Models...'}
              </button>
            ) : (
              <button
                onClick={() => knnTracker.stopTraining()}
                className="w-full px-2 py-1 border border-red-700 bg-red-600 hover:bg-red-500 text-white text-xs"
              >
                Done Training
              </button>
            )}

            {/* Training Mode Indicator */}
            {knnTracker.isTrainingMode && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-600 p-1">
                Training Mode Active: Click on the video to add samples
              </div>
            )}

            {/* Sample Counts */}
            <div className="text-xs bg-gray-50 border border-gray-400 p-1.5">
              <div className="grid grid-cols-2 gap-x-2">
                <span>Target Samples:</span>
                <span className="font-mono font-semibold">{knnTracker.targetSamples}</span>
                <span>Background Samples:</span>
                <span className="font-mono font-semibold">{knnTracker.backgroundSamples}</span>
              </div>
              {knnTracker.knnReady && (
                <div className="mt-1 text-green-700 font-semibold">
                  Ready to track!
                </div>
              )}
              {!knnTracker.knnReady && (knnTracker.targetSamples > 0 || knnTracker.backgroundSamples > 0) && (
                <div className="mt-1 text-orange-700">
                  Need at least 3 samples of each type
                </div>
              )}
            </div>

            {/* KNN Parameters */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">Window Size</label>
                <span className="text-xs font-mono text-gray-800">{config.knnWindowSize}px</span>
              </div>
              <input
                type="range"
                min="40"
                max="120"
                step="10"
                value={config.knnWindowSize}
                onChange={(e) => updateConfig({ knnWindowSize: Number(e.target.value) })}
                disabled={isTracking || knnTracker.isTrainingMode}
                className="w-full h-1 bg-gray-300 appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">Confidence</label>
                <span className="text-xs font-mono text-gray-800">
                  {(config.knnConfidence * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.knnConfidence * 100}
                onChange={(e) => updateConfig({ knnConfidence: Number(e.target.value) / 100 })}
                disabled={isTracking}
                className="w-full h-1 bg-gray-300 appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>

            {/* Debug Overlay Toggle */}
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={showDebugOverlay}
                onChange={(e) => setShowDebugOverlay(e.target.checked)}
                className="w-3 h-3"
              />
              Show Debug Overlay
            </label>
          </>
        )}

        {/* Brightness Panel */}
        {config.method === 'brightness' && (
          <>
            {/* Brightness threshold */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">Brightness Threshold</label>
                <span className="text-xs font-mono text-gray-800">{config.brightnessThreshold}</span>
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

            {/* Minimum pixel count */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">Min Pixel Count</label>
                <span className="text-xs font-mono text-gray-800">{config.minPixelCount}</span>
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

        {/* Buttons */}
        <div className="flex gap-1 pt-1">
          {!isTracking && !hasData && (
            <button
              onClick={handleStartTracking}
              disabled={isStartDisabled}
              className="flex-1 px-2 py-1 border border-gray-600 bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50"
            >
              Start
            </button>
          )}

          {isTracking && (
            <button
              onClick={handleStopTracking}
              className="flex-1 px-2 py-1 border border-red-700 bg-red-600 hover:bg-red-500 text-white text-xs"
            >
              Stop
            </button>
          )}

          {!isTracking && hasData && (
            <>
              <button
                onClick={handleStartTracking}
                disabled={isStartDisabled}
                className="flex-1 px-2 py-1 border border-gray-600 bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50"
              >
                Re-run
              </button>
              <button
                onClick={resetTracking}
                className="px-2 py-1 border border-gray-400 bg-gray-100 hover:bg-gray-200 text-xs"
              >
                Reset
              </button>
            </>
          )}
        </div>

        {/* Progress bar */}
        {isTracking && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Processing...</span>
              <span className="font-mono">{Math.round(trackingProgress)}%</span>
            </div>
            <div className="w-full bg-gray-300 h-2">
              <div
                className="bg-gray-700 h-full"
                style={{ width: `${trackingProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Status */}
        {hasData && !isTracking && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-600 p-1">
            Complete
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-red-800 bg-red-50 border border-red-600 p-1">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
