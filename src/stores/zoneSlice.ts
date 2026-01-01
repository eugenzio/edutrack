import { create } from 'zustand';
import type { Zone, ZoneShape, ZoneAnalytics, ZoneState } from '../types';

interface ZoneStore extends ZoneState {
  // Zone CRUD operations
  addZone: (zone: Omit<Zone, 'id' | 'createdAt'>) => void;
  updateZone: (id: string, updates: Partial<Omit<Zone, 'id' | 'createdAt'>>) => void;
  deleteZone: (id: string) => void;
  selectZone: (id: string | null) => void;

  // Drawing mode
  setDrawingMode: (mode: ZoneShape | null) => void;

  // Analytics
  setAnalytics: (analytics: ZoneAnalytics[]) => void;

  // Utility
  getZoneById: (id: string) => Zone | undefined;
  clearAllZones: () => void;
}

const ZONE_COLORS = [
  '#00ff00', // green
  '#0000ff', // blue
  '#ffff00', // yellow
  '#ff00ff', // magenta
  '#00ffff', // cyan
  '#ff8000', // orange
];

let zoneCounter = 0;

export const useZoneStore = create<ZoneStore>((set, get) => ({
  zones: [],
  selectedZoneId: null,
  drawingMode: null,
  analytics: [],

  addZone: (zone) => {
    const id = `zone_${Date.now()}_${zoneCounter++}`;
    const colorIndex = get().zones.length % ZONE_COLORS.length;
    const newZone: Zone = {
      ...zone,
      id,
      color: zone.color || ZONE_COLORS[colorIndex],
      createdAt: Date.now(),
    };

    set((state) => ({
      zones: [...state.zones, newZone],
      selectedZoneId: id,
      drawingMode: null,
    }));
  },

  updateZone: (id, updates) => {
    set((state) => ({
      zones: state.zones.map((zone) =>
        zone.id === id ? { ...zone, ...updates } : zone
      ),
    }));
  },

  deleteZone: (id) => {
    set((state) => ({
      zones: state.zones.filter((zone) => zone.id !== id),
      selectedZoneId: state.selectedZoneId === id ? null : state.selectedZoneId,
      analytics: state.analytics.filter((a) => a.zoneId !== id),
    }));
  },

  selectZone: (id) => {
    set({ selectedZoneId: id });
  },

  setDrawingMode: (mode) => {
    set({ drawingMode: mode, selectedZoneId: null });
  },

  setAnalytics: (analytics) => {
    set({ analytics });
  },

  getZoneById: (id) => {
    return get().zones.find((zone) => zone.id === id);
  },

  clearAllZones: () => {
    set({
      zones: [],
      selectedZoneId: null,
      drawingMode: null,
      analytics: [],
    });
  },
}));
