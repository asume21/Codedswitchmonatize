import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AudioVisualizerProps {
  className?: string;
  isPlaying?: boolean;
  data?: number[];
}

export function AudioVisualizer({
  className,
  isPlaying = false,
  data = []
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [visualData, setVisualData] = useState<number[]>(
    Array.from({ length: 64 }, () => Math.random() * 100)
  );

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      setVisualData(prev =>
        prev.map(() => Math.random() * 100)
      );
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const dataToUse = data.length > 0 ? data : visualData;

    ctx.clearRect(0, 0, width, height);

    const barWidth = width / dataToUse.length;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "hsl(262, 73%, 66%)");
    gradient.addColorStop(0.5, "hsl(187, 92%, 45%)");
    gradient.addColorStop(1, "hsl(328, 73%, 58%)");

    ctx.fillStyle = gradient;

    dataToUse.forEach((value, index) => {
      const barHeight = (value / 100) * height * 0.8;
      const x = index * barWidth;
      const y = height - barHeight;

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  }, [visualData, data]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={100}
      className={cn("bg-secondary rounded-lg", className)}
    />
  );
}