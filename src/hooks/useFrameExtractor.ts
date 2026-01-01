import { useEffect, useRef } from 'react';
import { useVideoStore } from '../stores/trackingStore';

interface UseFrameExtractorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function useFrameExtractor({ videoRef, canvasRef }: UseFrameExtractorProps) {
  const setCurrentTime = useVideoStore((state) => state.setCurrentTime);
  const isPlaying = useVideoStore((state) => state.playback.isPlaying);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Rendering loop using requestAnimationFrame
    const render = () => {
      if (!video.paused && !video.ended) {
        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Update store with current time
        setCurrentTime(video.currentTime);

        // Schedule next frame
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    // Start/stop rendering based on playback state
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(render);
    }

    // Cleanup
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoRef, canvasRef, isPlaying, setCurrentTime]);

  // Draw initial frame when video loads
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const handleLoadedData = () => {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw first frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    };

    video.addEventListener('loadeddata', handleLoadedData);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [videoRef, canvasRef]);
}
