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

            {!isVideoLoaded && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="text-6xl">🎥</div>
                  <h2 className="text-2xl font-bold text-gray-800">Welcome to EduTrack</h2>
                  <p className="text-gray-600">
                    Load a video file to start tracking objects using AI-powered detection,
                    KNN custom training, or brightness-based analysis.
                  </p>
                  <div className="bg-white/80 rounded-lg p-4 space-y-2 text-sm text-left">
                    <p className="font-semibold text-gray-700">Quick Start:</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-600">
                      <li>Click "Choose Video" above to load a video file</li>
                      <li>Select a tracking method (AI, Custom Train, or Brightness)</li>
                      <li>Configure tracking parameters</li>
                      <li>Click "Start Tracking" to analyze</li>
                      <li>Export results as CSV when complete</li>
                    </ol>
                  </div>
                  <div className="text-xs text-gray-500 pt-2">
                    Supported formats: MP4, WebM, MOV
                  </div>
                </div>
              </div>
            )}

            {isVideoLoaded && (
              <section>
                <PlaybackControls />
              </section>
            )}
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
