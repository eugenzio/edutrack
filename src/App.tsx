import { AppLayout } from './components/Layout/AppLayout';
import { VideoPlayer } from './components/VideoPlayer/VideoPlayer';
import { PlaybackControls } from './components/Controls/PlaybackControls';
import { TrackingControls } from './components/Tracking/TrackingControls';
import { MetricsPanel } from './components/Tracking/MetricsPanel';
import { ExportButton } from './components/Tracking/ExportButton';
import { CalibrationPanel } from './components/Calibration/CalibrationPanel';
import { ZoneToolbar } from './components/Zones/ZoneToolbar';
import { ZoneList } from './components/Zones/ZoneList';
import { ZoneResults } from './components/Zones/ZoneResults';
import { VideoRefsProvider } from './contexts/VideoRefsContext';
import { useVideoStore } from './stores/trackingStore';

function App() {
  const isVideoLoaded = useVideoStore((state) => state.isVideoLoaded());

  return (
    <VideoRefsProvider>
      <AppLayout>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* Left column: Video player and playback controls */}
          <div className="lg:col-span-2 space-y-4">
            <section>
              <VideoPlayer />
            </section>

            <section>
              <PlaybackControls />
            </section>
          </div>

          {/* Right column: Tracking controls, calibration, zones, and metrics */}
          {isVideoLoaded && (
            <div className="space-y-4">
              <section>
                <TrackingControls />
              </section>

              <section>
                <MetricsPanel />
              </section>

              <section>
                <CalibrationPanel />
              </section>

              <section>
                <ZoneToolbar />
              </section>

              <section>
                <ZoneList />
              </section>

              <section>
                <ZoneResults />
              </section>

              <section>
                <ExportButton />
              </section>
            </div>
          )}
        </div>
      </AppLayout>
    </VideoRefsProvider>
  );
}

export default App;
