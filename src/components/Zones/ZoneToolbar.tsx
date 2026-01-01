import { useZoneStore } from '../../stores/zoneSlice';
import { useTrackingStore } from '../../stores/trackingSlice';

export function ZoneToolbar() {
  const drawingMode = useZoneStore((state) => state.drawingMode);
  const setDrawingMode = useZoneStore((state) => state.setDrawingMode);
  const clearAllZones = useZoneStore((state) => state.clearAllZones);
  const zones = useZoneStore((state) => state.zones);
  const hasTrackingData = useTrackingStore((state) => state.hasTrackingData());

  if (!hasTrackingData) return null;

  const handleRectangleClick = () => {
    setDrawingMode(drawingMode === 'rectangle' ? null : 'rectangle');
  };

  const handleCircleClick = () => {
    setDrawingMode(drawingMode === 'circle' ? null : 'circle');
  };

  const handleClearAll = () => {
    if (zones.length > 0 && confirm('Delete all zones?')) {
      clearAllZones();
    }
  };

  return (
    <div className="border border-gray-300 bg-white">
      <div className="px-2 py-1 bg-gray-200 border-b border-gray-300 text-xs font-semibold">
        Zones
      </div>
      <div className="p-2 flex gap-1">
        <button
          onClick={handleRectangleClick}
          className={`px-2 py-1 text-xs border ${
            drawingMode === 'rectangle'
              ? 'border-gray-700 bg-gray-700 text-white'
              : 'border-gray-400 bg-gray-100 hover:bg-gray-200'
          }`}
        >
          □ Rectangle
        </button>
        <button
          onClick={handleCircleClick}
          className={`px-2 py-1 text-xs border ${
            drawingMode === 'circle'
              ? 'border-gray-700 bg-gray-700 text-white'
              : 'border-gray-400 bg-gray-100 hover:bg-gray-200'
          }`}
        >
          ○ Circle
        </button>
        {zones.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-2 py-1 text-xs border border-red-700 bg-red-600 hover:bg-red-500 text-white ml-auto"
          >
            Clear All
          </button>
        )}
      </div>
      {drawingMode && (
        <div className="px-2 py-1 text-xs bg-yellow-50 border-t border-yellow-600 text-yellow-900">
          Click and drag on the video to draw a {drawingMode}
        </div>
      )}
    </div>
  );
}
