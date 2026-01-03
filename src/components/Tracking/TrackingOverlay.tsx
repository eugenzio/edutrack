import React, { useEffect, useRef } from 'react';
import type { TrackingResult } from '../../types';

// Skeleton colors for pose visualization
const SKELETON_COLORS = {
  snout: '#00FF00',      // Green - nose/snout
  bodyCenter: '#0066FF', // Blue - body center
  tailBase: '#FF0000',   // Red - tail base
  connection: '#FFFFFF', // White - connecting lines
};

interface TrackingOverlayProps {
  results: TrackingResult[];
  currentFrameIndex: number;
  videoWidth: number;   // Original video resolution
  videoHeight: number;  // Original video resolution
}

export const TrackingOverlay: React.FC<TrackingOverlayProps> = ({
  results,
  currentFrameIndex,
  videoWidth,
  videoHeight
}) => {
  const trajectoryCanvasRef = useRef<HTMLCanvasElement>(null);
  const markerCanvasRef = useRef<HTMLCanvasElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const lastFrameIndexRef = useRef<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if we have pose data
  const hasPoseData = results.some(r => r.pose !== undefined);

  // 1. 캔버스 크기 맞추기 (부모 컨테이너 크기에 맞춤)
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = containerRef.current;
      if (container && trajectoryCanvasRef.current && markerCanvasRef.current && skeletonCanvasRef.current) {
        const rect = container.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;

        trajectoryCanvasRef.current.width = displayWidth;
        trajectoryCanvasRef.current.height = displayHeight;
        markerCanvasRef.current.width = displayWidth;
        markerCanvasRef.current.height = displayHeight;
        skeletonCanvasRef.current.width = displayWidth;
        skeletonCanvasRef.current.height = displayHeight;
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // 2. 궤적 그리기 (빨간 선)
  useEffect(() => {
    const canvas = trajectoryCanvasRef.current;
    if (!canvas || videoWidth === 0 || videoHeight === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 프레임이 바뀌었을 때만 다시 그리기
    if (currentFrameIndex === lastFrameIndexRef.current) return;
    lastFrameIndexRef.current = currentFrameIndex;

    // 좌표 스케일링: 원본 비디오 해상도 → 캔버스 크기
    const scaleX = canvas.width / videoWidth;
    const scaleY = canvas.height / videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    let hasStarted = false;
    let lastX = 0;
    let lastY = 0;

    // 화면 가장자리 여유분 (여기 찍힌 건 무시)
    const edgeMargin = Math.min(canvas.width, canvas.height) * 0.02; // 2% 여유

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      // 현재 프레임까지만 그림
      if (result.frameNumber > currentFrameIndex) break;

      if (result.centerOfMass) {
        // 원본 좌표를 캔버스 좌표로 스케일링
        const x = result.centerOfMass.x * scaleX;
        const y = result.centerOfMass.y * scaleY;

        // [필터 1] 유효하지 않은 점 (0,0) 스킵
        if (result.centerOfMass.x === 0 && result.centerOfMass.y === 0) {
          hasStarted = false;
          continue;
        }

        // [필터 2] 화면 범위 밖 점 스킵
        if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
          hasStarted = false;
          continue;
        }

        // [필터 3] 화면 가장자리 2% 이내에 있는 점은 그리지 않음 (케이지 벽 방지)
        if (x < edgeMargin || x > canvas.width - edgeMargin ||
            y < edgeMargin || y > canvas.height - edgeMargin) {
          hasStarted = false; // 끊어서 그림
          continue;
        }

        // [필터 4] 점프가 너무 크면(스케일된 200px) 선을 잇지 않음 (순간이동 방지)
        const scaledJumpThreshold = 200 * Math.min(scaleX, scaleY);
        if (hasStarted) {
          const dist = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
          if (dist > scaledJumpThreshold) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        } else {
          ctx.moveTo(x, y);
          hasStarted = true;
        }

        lastX = x;
        lastY = y;
      } else {
        // centerOfMass가 null일 때 - 감지 실패
        hasStarted = false;
        if (ctx) {
          ctx.stroke(); // 현재 경로 종료
        }
      }
    }
    ctx.stroke();

  }, [results, currentFrameIndex, videoWidth, videoHeight]);

  // 3. 현재 위치 표시 (빨간 점) - 부드러운 애니메이션
  useEffect(() => {
    const animate = () => {
      const canvas = markerCanvasRef.current;
      if (!canvas || videoWidth === 0 || videoHeight === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 좌표 스케일링: 원본 비디오 해상도 → 캔버스 크기
      const scaleX = canvas.width / videoWidth;
      const scaleY = canvas.height / videoHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 현재 프레임 데이터 찾기
      const currentResult = results.find(r => r.frameNumber === currentFrameIndex);

      if (currentResult?.centerOfMass) {
        // 원본 좌표를 캔버스 좌표로 스케일링
        const x = currentResult.centerOfMass.x * scaleX;
        const y = currentResult.centerOfMass.y * scaleY;

        // 가장자리 필터 통과한 경우에만 점 찍기
        const edgeMargin = Math.min(canvas.width, canvas.height) * 0.02;
        if (x >= edgeMargin && x <= canvas.width - edgeMargin &&
            y >= edgeMargin && y <= canvas.height - edgeMargin) {

          ctx.fillStyle = 'red';
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();

          // 좌표 텍스트 (원본 좌표 표시)
          ctx.fillStyle = 'white';
          ctx.font = '12px Arial';
          ctx.fillText(`(${Math.round(currentResult.centerOfMass.x)}, ${Math.round(currentResult.centerOfMass.y)})`, x + 10, y - 10);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [results, currentFrameIndex, videoWidth, videoHeight]);

  // 4. Skeleton rendering for pose tracking
  useEffect(() => {
    if (!hasPoseData) return;

    const canvas = skeletonCanvasRef.current;
    if (!canvas || videoWidth === 0 || videoHeight === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = canvas.width / videoWidth;
    const scaleY = canvas.height / videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find current frame's pose data
    const currentResult = results.find(r => r.frameNumber === currentFrameIndex);
    const pose = currentResult?.pose;

    if (!pose) return;

    const { snout, bodyCenter, tailBase } = pose;

    // Helper to scale point
    const scalePoint = (p: { x: number; y: number } | null) => {
      if (!p) return null;
      return { x: p.x * scaleX, y: p.y * scaleY };
    };

    const scaledSnout = scalePoint(snout);
    const scaledBody = scalePoint(bodyCenter);
    const scaledTail = scalePoint(tailBase);

    // Draw connecting lines (snout -> body -> tail)
    ctx.strokeStyle = SKELETON_COLORS.connection;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();

    if (scaledSnout && scaledBody) {
      ctx.moveTo(scaledSnout.x, scaledSnout.y);
      ctx.lineTo(scaledBody.x, scaledBody.y);
    }
    if (scaledBody && scaledTail) {
      if (!scaledSnout) {
        ctx.moveTo(scaledBody.x, scaledBody.y);
      }
      ctx.lineTo(scaledTail.x, scaledTail.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw keypoints
    const drawKeypoint = (
      point: { x: number; y: number } | null,
      color: string,
      label: string
    ) => {
      if (!point) return;

      // Outer circle with glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Inner circle
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = color;
      ctx.font = 'bold 10px Arial';
      ctx.fillText(label, point.x + 10, point.y - 8);
    };

    drawKeypoint(scaledSnout, SKELETON_COLORS.snout, 'Snout');
    drawKeypoint(scaledBody, SKELETON_COLORS.bodyCenter, 'Body');
    drawKeypoint(scaledTail, SKELETON_COLORS.tailBase, 'Tail');

    // Show confidence if available
    if (currentResult?.poseConfidence !== undefined) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '11px Arial';
      ctx.fillText(
        `Pose: ${(currentResult.poseConfidence * 100).toFixed(0)}%`,
        10,
        canvas.height - 10
      );
    }
  }, [results, currentFrameIndex, videoWidth, videoHeight, hasPoseData]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10
      }}
    >
      <canvas
        ref={trajectoryCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
      <canvas
        ref={markerCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />
      {/* Skeleton canvas for pose visualization */}
      <canvas
        ref={skeletonCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 2
        }}
      />
    </div>
  );
};
