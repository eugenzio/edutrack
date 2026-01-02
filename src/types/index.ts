// Core geometric types
export interface Point {
  x: number;
  y: number;
  timestamp: number;
}

// Video metadata
export interface VideoMetadata {
  filename: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  fileSize: number;
  uploadedAt: number;
}

// Frame data for future tracking (Phase 2)
export interface FrameData {
  frameNumber: number;
  timestamp: number;
  points: Point[];
}

// Tracking configuration (Phase 2)
export interface TrackingConfig {
  targetColor?: string;
  minArea?: number;
  maxArea?: number;
  sensitivity?: number;
}

// Tracking result for single frame
export interface TrackingResult {
  frameNumber: number;
  timestamp: number;
  centerOfMass: Point | null;
  pixelCount: number;
  brightnessAverage: number;

  // NEW: Optional AI fields (only present when method === 'ai-object')
  aiBBox?: BBox;
  aiClass?: string;
  aiScore?: number;
}

// Tracking configuration
export interface TrackingConfiguration {
  // Existing brightness tracking fields
  brightnessThreshold: number;
  minPixelCount: number;
  sampleEveryNthFrame: number;

  // NEW: Method selector
  method: TrackingMethod;

  // NEW: AI-specific configuration
  aiConfidence: number;              // 0.0-1.0, default 0.5
  aiTargetClass: string | null;      // e.g., "person", "sports ball"
  aiTrackStrategy: AiTrackStrategy;  // default 'nearestPrev'
  aiMaxJumpPx: number;               // default 200
  aiLostFrameTolerance: number;      // default 5

  // NEW: KNN custom training configuration
  knnWindowSize: number;             // Sliding window size for search, default 80
  knnSearchRadius: number;           // Search radius around last position, default 100
  knnConfidence: number;             // Minimum confidence for KNN prediction, default 0.6

  // NEW: Mouse tracker configuration (Background Subtraction)
  mouseThreshold: number;            // Difference threshold for background subtraction, default 25
  mouseMinArea: number;              // Minimum blob area in pixels to filter noise, default 100
  mouseMaxArea: number;              // Maximum blob area in pixels to filter cage structures, default 1500
  mouseInvert: boolean;              // Invert mask for black mice on light background, default false
  mouseErosion: boolean;             // Apply morphological erosion to remove tail, default true
}

// Tracking state
export interface TrackingState {
  isTracking: boolean;
  trackingProgress: number;
  results: TrackingResult[];
  config: TrackingConfiguration;
  error: string | null;
}

// Tracking metrics
export interface TrackingMetrics {
  totalDistance: number;
  totalDistanceScaled: number;
  averageSpeed: number;
  maxSpeed: number;
  minSpeed: number;
  totalFramesTracked: number;
  successfulDetections: number;
  failedDetections: number;
}

// Playback state
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
}

// Video store state
export interface VideoState {
  videoFile: File | null;
  videoUrl: string | null;
  metadata: VideoMetadata | null;
  playback: PlaybackState;
  error: string | null;
}

// Error types
export type VideoError =
  | 'FILE_TOO_LARGE'
  | 'INVALID_FORMAT'
  | 'LOAD_FAILED'
  | 'PLAYBACK_ERROR';

// Zone types (Phase 3 - ROI)
export type ZoneShape = 'rectangle' | 'circle';

export interface Zone {
  id: string;
  name: string;
  shape: ZoneShape;
  color: string;
  // Rectangle: x, y is top-left corner; width, height define size
  // Circle: x, y is center; width is diameter (height ignored)
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: number;
}

export interface ZoneAnalytics {
  zoneId: string;
  zoneName: string;
  timeInZone: number; // seconds
  entryCount: number;
  exitCount: number;
  firstEntry: number | null; // timestamp
  lastExit: number | null; // timestamp
}

export interface ZoneState {
  zones: Zone[];
  selectedZoneId: string | null;
  drawingMode: ZoneShape | null;
  analytics: ZoneAnalytics[];
}

// Calibration types (Phase 4 - Scale)
export interface CalibrationLine {
  start: Point;
  end: Point;
  pixelLength: number;
  realDistanceCm: number;
}

export interface CalibrationState {
  line: CalibrationLine | null;
  pixelsPerCm: number | null;
  isDrawingCalibration: boolean;
  drawingStart: Point | null;
}

// AI Tracking types (Phase 5)
export type TrackingMethod = 'ai-object' | 'brightness' | 'knn-custom' | 'mouse-tracker';

export interface BBox {
  x: number;      // top-left x coordinate
  y: number;      // top-left y coordinate
  width: number;  // bounding box width
  height: number; // bounding box height
}

export type AiTrackStrategy = 'nearestPrev' | 'highestScore' | 'largest';
export type AiBoxSource = 'auto' | 'user';
