import { useAnalytics } from '../../hooks/useAnalytics';
import { useTrackingStore } from '../../stores/trackingSlice';
import { useCalibrationStore } from '../../stores/calibrationSlice';
import { formatDistance, formatSpeed } from '../../utils/calibration';

export function MetricsPanel() {
  const hasData = useTrackingStore((state) => state.hasTrackingData());
  const { metrics } = useAnalytics();
  const pixelsPerCm = useCalibrationStore((state) => state.pixelsPerCm);

  if (!hasData) return null;

  return (
    <div className="border border-gray-300 bg-white">
      <div className="px-2 py-1 bg-gray-200 border-b border-gray-300 text-xs font-semibold">
        Results
      </div>

      <div className="p-2">
        <table className="w-full text-xs">
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-1 text-gray-600">Distance:</td>
              <td className="py-1 text-right font-mono">{formatDistance(metrics.totalDistance, pixelsPerCm)}</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-1 text-gray-600">Avg Speed:</td>
              <td className="py-1 text-right font-mono">{formatSpeed(metrics.averageSpeed, pixelsPerCm)}</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-1 text-gray-600">Max Speed:</td>
              <td className="py-1 text-right font-mono">{formatSpeed(metrics.maxSpeed, pixelsPerCm)}</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-1 text-gray-600">Frames:</td>
              <td className="py-1 text-right font-mono">{metrics.totalFramesTracked}</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-1 text-gray-600">Detections:</td>
              <td className="py-1 text-right font-mono">
                {metrics.successfulDetections} / {metrics.totalFramesTracked}
              </td>
            </tr>
            <tr>
              <td className="py-1 text-gray-600">Success Rate:</td>
              <td className="py-1 text-right font-mono">
                {((metrics.successfulDetections / metrics.totalFramesTracked) * 100).toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
