import { useTrackingStore } from '../../stores/trackingSlice';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useZoneStore } from '../../stores/zoneSlice';
import { useCalibrationStore } from '../../stores/calibrationSlice';
import { exportTrackingDataToCSV } from '../../utils/exportCsv';

export function ExportButton() {
  const hasData = useTrackingStore((state) => state.hasTrackingData());
  const { detailedData } = useAnalytics();
  const zones = useZoneStore((state) => state.zones);
  const pixelsPerCm = useCalibrationStore((state) => state.pixelsPerCm);

  if (!hasData) return null;

  const handleExport = () => {
    exportTrackingDataToCSV(detailedData, zones, pixelsPerCm);
  };

  return (
    <div className="border border-gray-300 bg-white">
      <div className="px-2 py-1 bg-gray-200 border-b border-gray-300 text-xs font-semibold">
        Export
      </div>
      <div className="p-2">
        <button
          onClick={handleExport}
          className="w-full px-2 py-1 border border-gray-600 bg-gray-700 hover:bg-gray-600 text-white text-xs"
        >
          Export to CSV
        </button>
      </div>
    </div>
  );
}
