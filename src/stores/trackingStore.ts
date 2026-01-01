import { create } from 'zustand';
import type { VideoState, VideoMetadata, PlaybackState } from '../types';

interface VideoStore extends VideoState {
  // Actions
  loadVideo: (file: File) => Promise<void>;
  unloadVideo: () => void;
  setPlaybackState: (state: Partial<PlaybackState>) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setError: (error: string | null) => void;

  // Computed getters
  isVideoLoaded: () => boolean;
  getProgress: () => number;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB limit
const SUPPORTED_FORMATS = ['video/mp4', 'video/webm', 'video/ogg'];

export const useVideoStore = create<VideoStore>((set, get) => ({
  // Initial state
  videoFile: null,
  videoUrl: null,
  metadata: null,
  playback: {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
  },
  error: null,

  // Actions
  loadVideo: async (file: File) => {
    // Validation
    if (file.size > MAX_FILE_SIZE) {
      set({ error: 'File size exceeds 500MB limit' });
      return;
    }

    if (!SUPPORTED_FORMATS.includes(file.type)) {
      set({ error: 'Unsupported video format. Use MP4, WebM, or OGG.' });
      return;
    }

    // Clean up old video
    const oldUrl = get().videoUrl;
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
    }

    // Create object URL
    const url = URL.createObjectURL(file);

    // Extract metadata using temporary video element
    const video = document.createElement('video');
    video.preload = 'metadata';

    const metadataPromise = new Promise<VideoMetadata>((resolve, reject) => {
      video.onloadedmetadata = () => {
        const metadata: VideoMetadata = {
          filename: file.name,
          duration: video.duration,
          fps: 30, // Default, can be calculated more accurately later
          width: video.videoWidth,
          height: video.videoHeight,
          fileSize: file.size,
          uploadedAt: Date.now(),
        };
        resolve(metadata);
      };
      video.onerror = () => reject(new Error('Failed to load video metadata'));
    });

    video.src = url;

    try {
      const metadata = await metadataPromise;

      set({
        videoFile: file,
        videoUrl: url,
        metadata,
        playback: {
          isPlaying: false,
          currentTime: 0,
          duration: metadata.duration,
          playbackRate: 1,
        },
        error: null,
      });
    } catch (error) {
      URL.revokeObjectURL(url);
      set({ error: 'Failed to load video. Please try another file.' });
    }
  },

  unloadVideo: () => {
    const url = get().videoUrl;
    if (url) {
      URL.revokeObjectURL(url);
    }

    set({
      videoFile: null,
      videoUrl: null,
      metadata: null,
      playback: {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1,
      },
      error: null,
    });
  },

  setPlaybackState: (state: Partial<PlaybackState>) => {
    set((prev) => ({
      playback: { ...prev.playback, ...state },
    }));
  },

  setCurrentTime: (time: number) => {
    set((prev) => ({
      playback: { ...prev.playback, currentTime: time },
    }));
  },

  setPlaybackRate: (rate: number) => {
    set((prev) => ({
      playback: { ...prev.playback, playbackRate: rate },
    }));
  },

  setError: (error: string | null) => {
    set({ error });
  },

  // Computed getters
  isVideoLoaded: () => get().videoUrl !== null,

  getProgress: () => {
    const { currentTime, duration } = get().playback;
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  },
}));
