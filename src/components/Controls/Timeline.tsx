import { useRef, type MouseEvent } from 'react';
import { useVideoStore } from '../../stores/trackingStore';
import { formatTime } from '../../utils/calculations';

export function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const playback = useVideoStore((state) => state.playback);
  const setCurrentTime = useVideoStore((state) => state.setCurrentTime);
  const progress = useVideoStore((state) => state.getProgress());

  const handleTimelineClick = (e: MouseEvent<HTMLDivElement>) => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const rect = timeline.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * playback.duration;

    setCurrentTime(newTime);
  };

  return (
    <div className="space-y-1">
      {/* Time display */}
      <div className="flex justify-between text-xs font-mono text-gray-700">
        <span>{formatTime(playback.currentTime)}</span>
        <span>{formatTime(playback.duration)}</span>
      </div>

      {/* Timeline bar */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="h-2 bg-gray-300 cursor-pointer hover:bg-gray-400"
      >
        <div
          className="h-full bg-gray-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
