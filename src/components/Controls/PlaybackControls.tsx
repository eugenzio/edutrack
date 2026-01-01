import { useVideoStore } from '../../stores/trackingStore';
import { Timeline } from './Timeline';

export function PlaybackControls() {
  const isLoaded = useVideoStore((state) => state.isVideoLoaded());
  const playback = useVideoStore((state) => state.playback);
  const setPlaybackState = useVideoStore((state) => state.setPlaybackState);
  const setPlaybackRate = useVideoStore((state) => state.setPlaybackRate);
  const unloadVideo = useVideoStore((state) => state.unloadVideo);
  const metadata = useVideoStore((state) => state.metadata);

  if (!isLoaded) return null;

  const togglePlayPause = () => {
    setPlaybackState({ isPlaying: !playback.isPlaying });
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
  };

  const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="border border-gray-300 bg-white">
      {/* Timeline */}
      <div className="p-2 border-b border-gray-300">
        <Timeline />
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-300">
        {/* Play/Pause */}
        <button
          onClick={togglePlayPause}
          className="px-3 py-1 border border-gray-400 bg-gray-100 hover:bg-gray-200 text-xs font-medium"
        >
          {playback.isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        {/* Playback rate selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-600">Speed:</span>
          <select
            value={playback.playbackRate}
            onChange={(e) => handleRateChange(Number(e.target.value))}
            className="px-1 py-0.5 text-xs border border-gray-400 bg-white focus:outline-none focus:border-gray-600"
          >
            {playbackRates.map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1"></div>

        {/* Unload video button */}
        <button
          onClick={unloadVideo}
          className="px-2 py-1 border border-red-700 bg-red-600 hover:bg-red-500 text-white text-xs"
        >
          Close
        </button>
      </div>

      {/* Video info */}
      {metadata && (
        <div className="px-2 py-1 text-xs text-gray-600 font-mono bg-gray-50">
          <span className="font-medium">{metadata.filename}</span>
          <span className="mx-2">|</span>
          <span>
            {metadata.width}×{metadata.height}
          </span>
          <span className="mx-2">|</span>
          <span>{Math.round(metadata.fps)} FPS</span>
          <span className="mx-2">|</span>
          <span>{(metadata.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
        </div>
      )}
    </div>
  );
}
