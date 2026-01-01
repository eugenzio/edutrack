import { useState } from 'react';
import { useZoneStore } from '../../stores/zoneSlice';

export function ZoneList() {
  const zones = useZoneStore((state) => state.zones);
  const selectedZoneId = useZoneStore((state) => state.selectedZoneId);
  const selectZone = useZoneStore((state) => state.selectZone);
  const deleteZone = useZoneStore((state) => state.deleteZone);
  const updateZone = useZoneStore((state) => state.updateZone);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (zones.length === 0) return null;

  const handleEditStart = (zoneId: string, currentName: string) => {
    setEditingId(zoneId);
    setEditName(currentName);
  };

  const handleEditSave = (zoneId: string) => {
    if (editName.trim()) {
      updateZone(zoneId, { name: editName.trim() });
    }
    setEditingId(null);
    setEditName('');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (zoneId: string) => {
    if (confirm('Delete this zone?')) {
      deleteZone(zoneId);
    }
  };

  return (
    <div className="border border-gray-300 bg-white">
      <div className="px-2 py-1 bg-gray-200 border-b border-gray-300 text-xs font-semibold">
        Zone List
      </div>
      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 border-b border-gray-300 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left">Color</th>
              <th className="px-2 py-1 text-left">Name</th>
              <th className="px-2 py-1 text-left">Shape</th>
              <th className="px-2 py-1 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr
                key={zone.id}
                className={`border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                  selectedZoneId === zone.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => selectZone(zone.id)}
              >
                <td className="px-2 py-1">
                  <div
                    className="w-4 h-4 border border-gray-400"
                    style={{ backgroundColor: zone.color }}
                  />
                </td>
                <td className="px-2 py-1">
                  {editingId === zone.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave(zone.id);
                        if (e.key === 'Escape') handleEditCancel();
                      }}
                      onBlur={() => handleEditSave(zone.id)}
                      className="w-full px-1 py-0 text-xs border border-gray-400"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="font-mono">{zone.name}</span>
                  )}
                </td>
                <td className="px-2 py-1 text-gray-600">
                  {zone.shape === 'rectangle' ? '□' : '○'} {zone.shape}
                </td>
                <td className="px-2 py-1 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditStart(zone.id, zone.name);
                    }}
                    className="px-1 text-xs text-blue-700 hover:underline"
                  >
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(zone.id);
                    }}
                    className="px-1 text-xs text-red-700 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
