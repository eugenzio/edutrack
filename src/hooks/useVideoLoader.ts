import { useCallback } from 'react';
import { useVideoStore } from '../stores/trackingStore';

export function useVideoLoader() {
  const loadVideo = useVideoStore((state) => state.loadVideo);
  const unloadVideo = useVideoStore((state) => state.unloadVideo);
  const error = useVideoStore((state) => state.error);
  const isLoaded = useVideoStore((state) => state.isVideoLoaded());

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];
      await loadVideo(file);
    },
    [loadVideo]
  );

  const handleFileDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      await handleFileSelect(files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return {
    handleFileSelect,
    handleFileDrop,
    handleDragOver,
    unloadVideo,
    error,
    isLoaded,
  };
}
