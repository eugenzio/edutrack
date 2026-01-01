import { useState } from 'react';
import { useCalibrationStore } from '../../stores/calibrationSlice';
import { useVideoStore } from '../../stores/trackingStore';

export function CalibrationPanel() {
  const isVideoLoaded = useVideoStore((state) => state.isVideoLoaded());
  const line = useCalibrationStore((state) => state.line);
  const pixelsPerCm = useCalibrationStore((state) => state.pixelsPerCm);
  const isDrawingCalibration = useCalibrationStore((state) => state.isDrawingCalibration);
  const startDrawing = useCalibrationStore((state) => state.startDrawing);
  const setRealDistance = useCalibrationStore((state) => state.setRealDistance);
  const clearCalibration = useCalibrationStore((state) => state.clearCalibration);
  const cancelDrawing = useCalibrationStore((state) => state.cancelDrawing);

  const [inputValue, setInputValue] = useState(line?.realDistanceCm.toString() || '10');

  if (!isVideoLoaded) return null;

  const handleSetScale = () => {
    if (isDrawingCalibration) {
      cancelDrawing();
    } else {
      startDrawing({ x: 0, y: 0, timestamp: Date.now() });
    }
  };

  const handleApply = () => {
    const value = parseFloat(inputValue);
    if (!isNaN(value) && value > 0) {
      setRealDistance(value);
    }
  };

  const handleClear = () => {
    clearCalibration();
    setInputValue('10');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  return (
    <div className="border border-gray-300 bg-white">
      <div className="px-2 py-1 bg-gray-200 border-b border-gray-300 text-xs font-semibold">
        Calibration
      </div>

      <div className="p-2 space-y-2">
        {/* Buttons */}
        <div className="flex gap-1">
          <button
            onClick={handleSetScale}
            className={`px-2 py-1 text-xs border ${
              isDrawingCalibration
                ? 'border-blue-700 bg-blue-600 text-white'
                : 'border-gray-400 bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {isDrawingCalibration ? 'Drawing...' : 'Set Scale'}
          </button>

          {line && (
            <button
              onClick={handleClear}
              className="px-2 py-1 text-xs border border-gray-400 bg-gray-100 hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Drawing instructions */}
        {isDrawingCalibration && (
          <div className="text-xs bg-blue-50 border border-blue-600 p-1 text-blue-900">
            Click two points on the video to set scale. Press ESC to cancel.
          </div>
        )}

        {/* Calibration info */}
        {line && (
          <>
            <div className="space-y-1 pt-1 border-t border-gray-200">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Reference Line:</span>
                <span className="font-mono text-gray-800">{line.pixelLength.toFixed(1)} px</span>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600">Real Distance:</span>
                <input
                  type="number"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-1 py-0.5 text-xs border border-gray-400 font-mono"
                  step="0.1"
                  min="0.1"
                />
                <span className="text-xs text-gray-600">cm</span>
                <button
                  onClick={handleApply}
                  className="px-2 py-0.5 text-xs border border-gray-600 bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Apply
                </button>
              </div>

              {pixelsPerCm && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Scale:</span>
                  <span className="font-mono text-gray-800">{pixelsPerCm.toFixed(2)} px/cm</span>
                </div>
              )}
            </div>

            <div className="text-xs text-green-700 bg-green-50 border border-green-600 p-1">
              ✓ Calibrated
            </div>
          </>
        )}
      </div>
    </div>
  );
}
