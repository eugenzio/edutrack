import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';

interface VideoRefsContextValue {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
}

const VideoRefsContext = createContext<VideoRefsContextValue | null>(null);

export function VideoRefsProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <VideoRefsContext.Provider value={{ videoRef, canvasRef }}>
      {children}
    </VideoRefsContext.Provider>
  );
}

export function useVideoRefs() {
  const context = useContext(VideoRefsContext);
  if (!context) {
    throw new Error('useVideoRefs must be used within VideoRefsProvider');
  }
  return context;
}
