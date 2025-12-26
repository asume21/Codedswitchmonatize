interface GridOverlayProps {
  duration: number;
  zoom: number;
  showGrid: boolean;
  timelineWidth?: number;
}

const formatMark = (seconds: number) => {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
  }
  return `${seconds.toFixed(seconds < 1 ? 2 : seconds < 10 ? 1 : 0)}s`;
};

export function GridOverlay({ duration, zoom, showGrid, timelineWidth }: GridOverlayProps) {
  if (!showGrid) return null;
  const pxPerSecond = 120 * zoom;
  const effectiveDuration = Math.max(duration, 1);
  const width = Math.max(timelineWidth ?? effectiveDuration * pxPerSecond, 600);
  const spacingCandidates = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
  const secondsPerMark = spacingCandidates.find((sec) => sec * pxPerSecond >= 60) ?? 32;
  const marks = Math.ceil((width / pxPerSecond) / secondsPerMark) + 2;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ width }}>
      <div className="absolute top-0 left-0 right-0 h-7 bg-gradient-to-b from-gray-900 via-gray-900/80 to-transparent">
        {Array.from({ length: marks }).map((_, i) => {
          const left = i * secondsPerMark * pxPerSecond;
          return (
            <div
              key={`label-${i}`}
              className="absolute top-0 border-l border-gray-700/60 text-[11px] text-gray-400"
              style={{ left }}
            >
              <div className="absolute -top-1 left-1">{formatMark(i * secondsPerMark)}</div>
            </div>
          );
        })}
      </div>
      {Array.from({ length: marks }).map((_, i) => {
        const left = i * secondsPerMark * pxPerSecond;
        return (
          <div
            key={`line-${i}`}
            className="absolute top-0 bottom-0 border-l border-gray-700/40"
            style={{ left }}
          />
        );
      })}
    </div>
  );
}
