import { useEffect } from 'react';
import { useZoneStore } from '../../stores/zoneSlice';
import { useTrackingStore } from '../../stores/trackingSlice';
import { useVideoStore } from '../../stores/trackingStore';
import { analyzeZones } from '../../utils/zoneAnalysis';

export function ZoneResults() {
  const zones = useZoneStore((state) => state.zones);
  const analytics = useZoneStore((state) => state.analytics);
  const setAnalytics = useZoneStore((state) => state.setAnalytics);
  const trackingResults = useTrackingStore((state) => state.results);
  const hasTrackingData = useTrackingStore((state) => state.hasTrackingData());
  const metadata = useVideoStore((state) => state.metadata);

  // Recalculate analytics when zones or tracking results change
  useEffect(() => {
    if (hasTrackingData && zones.length > 0 && metadata) {
      const newAnalytics = analyzeZones(zones, trackingResults, metadata.fps);
      setAnalytics(newAnalytics);
    } else {
      setAnalytics([]);
    }
  }, [zones, trackingResults, hasTrackingData, metadata, setAnalytics]);

  if (!hasTrackingData || zones.length === 0 || analytics.length === 0) {
    return null;
  }

  const formatTime = (seconds: number) => {
    return seconds.toFixed(2) + 's';
  };

  return (
    <div className="border border-gray-300 bg-white">
      <div className="px-2 py-1 bg-gray-200 border-b border-gray-300 text-xs font-semibold">
        Zone Analytics
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 border-b border-gray-300 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left">Zone</th>
              <th className="px-2 py-1 text-right">Time</th>
              <th className="px-2 py-1 text-right">Entries</th>
              <th className="px-2 py-1 text-right">Exits</th>
            </tr>
          </thead>
          <tbody>
            {analytics.map((analytic) => (
              <tr key={analytic.zoneId} className="border-b border-gray-200">
                <td className="px-2 py-1 font-mono">{analytic.zoneName}</td>
                <td className="px-2 py-1 text-right font-mono">
                  {formatTime(analytic.timeInZone)}
                </td>
                <td className="px-2 py-1 text-right font-mono">{analytic.entryCount}</td>
                <td className="px-2 py-1 text-right font-mono">{analytic.exitCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
