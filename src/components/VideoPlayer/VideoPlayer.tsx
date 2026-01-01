import { useVideoStore } from '../../stores/trackingStore';
import { DropZone } from './DropZone';
import { VideoCanvas } from './VideoCanvas';

export function VideoPlayer() {
  const isLoaded = useVideoStore((state) => state.isVideoLoaded());

  return (
    <div className="space-y-6">
      {isLoaded ? <VideoCanvas /> : <DropZone />}
    </div>
  );
}
