import * as React from "react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type AstutelyTone = "cyan" | "magenta" | "emerald" | "amber" | "red";

type Orientation = "horizontal" | "vertical";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundToStep(value: number, step: number) {
  if (!Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}

function tone(t: AstutelyTone) {
  switch (t) {
    case "magenta":
      return {
        border: "border-fuchsia-500/40",
        text: "text-fuchsia-200",
        softText: "text-fuchsia-200/70",
        glow: "shadow-[0_0_22px_rgba(217,70,239,0.22)]",
        led: "bg-fuchsia-400",
      };
    case "emerald":
      return {
        border: "border-emerald-500/40",
        text: "text-emerald-200",
        softText: "text-emerald-200/70",
        glow: "shadow-[0_0_22px_rgba(16,185,129,0.22)]",
        led: "bg-emerald-400",
      };
    case "amber":
      return {
        border: "border-amber-500/40",
        text: "text-amber-200",
        softText: "text-amber-200/70",
        glow: "shadow-[0_0_22px_rgba(245,158,11,0.2)]",
        led: "bg-amber-400",
      };
    case "red":
      return {
        border: "border-red-500/40",
        text: "text-red-200",
        softText: "text-red-200/70",
        glow: "shadow-[0_0_22px_rgba(239,68,68,0.2)]",
        led: "bg-red-400",
      };
    case "cyan":
    default:
      return {
        border: "border-cyan-500/40",
        text: "text-cyan-100",
        softText: "text-cyan-200/70",
        glow: "shadow-[0_0_22px_rgba(6,182,212,0.22)]",
        led: "bg-cyan-300",
      };
  }
}

export type AstutelyLedButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "color"
> & {
  active?: boolean;
  tone?: AstutelyTone;
  size?: "sm" | "md";
};

export function AstutelyLedButton({
  active = false,
  tone: toneName = "cyan",
  size = "md",
  className,
  ...props
}: AstutelyLedButtonProps) {
  const t = tone(toneName);
  const sizeClass = size === "sm" ? "h-8 px-3 text-[10px]" : "h-10 px-4 text-[11px]";

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border font-black uppercase tracking-widest transition-all",
        "bg-black/70 backdrop-blur-md",
        active
          ? cn("bg-black/60", t.border, t.text, t.glow)
          : "border-white/10 text-white/40 hover:text-white hover:bg-cyan-500/10",
        sizeClass,
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          active ? cn(t.led, "shadow-[0_0_14px_rgba(255,255,255,0.35)]") : "bg-white/10"
        )}
      />
      {props.children}
    </button>
  );
}

export type AstutelyKnobProps = {
  label?: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  tone?: AstutelyTone;
  size?: number;
  unit?: string;
  className?: string;
  disabled?: boolean;
};

export function AstutelyKnob({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  tone: toneName = "cyan",
  size = 56,
  unit,
  className,
  disabled,
}: AstutelyKnobProps) {
  const t = tone(toneName);
  const v = clamp(value, min, max);

  const angle = React.useMemo(() => {
    const span = 270;
    const start = -135;
    const ratio = max === min ? 0 : (v - min) / (max - min);
    return start + ratio * span;
  }, [v, min, max]);

  const drag = React.useRef<{ pointerId: number; startY: number; startValue: number } | null>(null);

  const commit = React.useCallback(
    (next: number) => {
      const rounded = roundToStep(next, step);
      onValueChange(clamp(rounded, min, max));
    },
    [max, min, onValueChange, step]
  );

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { pointerId: e.pointerId, startY: e.clientY, startValue: v };
    },
    [disabled, v]
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (!drag.current || drag.current.pointerId !== e.pointerId) return;
      const dy = drag.current.startY - e.clientY;
      const range = max - min;
      const pixelsForFullRange = 180;
      commit(drag.current.startValue + (dy / pixelsForFullRange) * range);
    },
    [commit, disabled, max, min]
  );

  const onPointerUp = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  }, []);

  const ticks = React.useMemo(() => {
    const count = 21;
    const span = 270;
    const start = -135;
    const radius = -(size / 2) + 8;

    return Array.from({ length: count }, (_, i) => {
      const a = start + (i / (count - 1)) * span;
      const major = i % 5 === 0;
      return { a, major, radius };
    });
  }, [size]);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {label && <span className={cn("text-[10px] font-black uppercase tracking-widest", t.softText)}>{label}</span>}
      <button
        type="button"
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "relative grid place-items-center rounded-full bg-black/80 backdrop-blur-md",
          "astutely-neon-ring",
          t.glow,
          "focus-visible:outline-none focus-visible:ring-2",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        style={{ width: size, height: size }}
        aria-label={label ?? "Knob"}
      >
        <div className={cn("absolute inset-[2px] rounded-full border", t.border)} />
        <div
          className="absolute inset-1 rounded-full border border-white/10"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.10), rgba(0,0,0,0.72) 55%, rgba(0,0,0,0.92) 100%)",
          }}
        />
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.22)_1px,transparent_1px)] bg-[length:100%_6px] rounded-full" />
        <div className="absolute inset-0 pointer-events-none">
          {ticks.map((tick) => (
            <div
              key={`${tick.a}`}
              className={cn(
                "absolute left-1/2 top-1/2 rounded-full",
                tick.major ? "h-[7px] w-[2px] bg-white/35" : "h-[4px] w-[1px] bg-white/20"
              )}
              style={{
                transform: `translate(-50%, -50%) rotate(${tick.a}deg) translateY(${tick.radius}px)`,
              }}
              aria-hidden
            />
          ))}
        </div>
        <div
          className={cn(
            "absolute w-[2px] h-[40%] rounded-full",
            "bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.6)]"
          )}
          style={{ transform: `rotate(${angle}deg) translateY(-12%)` }}
        />
        <div className="relative z-10 text-[10px] font-black text-white/80 tabular-nums">
          {Math.round(v)}{unit ?? ""}
        </div>
      </button>
    </div>
  );
}

export type AstutelyMeterProps = {
  value: number;
  orientation?: Orientation;
  tone?: AstutelyTone;
  className?: string;
  showPeak?: boolean;
};

export function AstutelyMeter({
  value,
  orientation = "vertical",
  tone: toneName = "cyan",
  className,
  showPeak = true,
}: AstutelyMeterProps) {
  const t = tone(toneName);

  const meterGradient = React.useMemo(() => {
    const dir = orientation === "vertical" ? "to top" : "to right";
    if (toneName === "emerald") return `linear-gradient(${dir}, rgba(5,150,105,0.95) 0%, rgba(16,185,129,0.95) 65%, rgba(255,255,255,0.92) 100%)`;
    if (toneName === "amber") return `linear-gradient(${dir}, rgba(180,83,9,0.95) 0%, rgba(245,158,11,0.95) 65%, rgba(255,255,255,0.92) 100%)`;
    if (toneName === "red") return `linear-gradient(${dir}, rgba(185,28,28,0.95) 0%, rgba(239,68,68,0.95) 65%, rgba(255,255,255,0.92) 100%)`;
    if (toneName === "magenta") return `linear-gradient(${dir}, rgba(147,51,234,0.95) 0%, rgba(217,70,239,0.95) 65%, rgba(255,255,255,0.92) 100%)`;
    return `linear-gradient(${dir}, rgba(6,182,212,0.95) 0%, rgba(217,70,239,0.92) 56%, rgba(245,158,11,0.92) 82%, rgba(255,255,255,0.95) 100%)`;
  }, [orientation, toneName]);

  const normalized = React.useMemo(() => {
    if (!Number.isFinite(value)) return 0;
    if (value <= 1) return clamp(value, 0, 1);
    return clamp(value / 100, 0, 1);
  }, [value]);

  const [peak, setPeak] = React.useState(0);

  React.useEffect(() => {
    if (!showPeak) return;
    if (normalized > peak) setPeak(normalized);
  }, [normalized, peak, showPeak]);

  React.useEffect(() => {
    if (!showPeak) return;
    if (peak <= normalized) return;
    const id = window.setTimeout(() => setPeak((p) => Math.max(normalized, p - 0.06)), 80);
    return () => window.clearTimeout(id);
  }, [peak, normalized, showPeak]);

  const fillStyle =
    orientation === "vertical" ? { height: `${normalized * 100}%` } : { width: `${normalized * 100}%` };
  const peakStyle = orientation === "vertical" ? { bottom: `${peak * 100}%` } : { left: `${peak * 100}%` };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-black/70 backdrop-blur-md",
        t.border,
        "shadow-[0_0_22px_rgba(6,182,212,0.22),0_0_18px_rgba(217,70,239,0.14),0_0_16px_rgba(245,158,11,0.12)]",
        orientation === "vertical" ? "h-24 w-4" : "h-4 w-24",
        className
      )}
    >
      <div
        className={cn(
          "absolute",
          orientation === "vertical" ? "bottom-0 left-0 w-full" : "left-0 top-0 h-full",
          "shadow-[0_0_18px_rgba(6,182,212,0.28),0_0_14px_rgba(217,70,239,0.18),0_0_12px_rgba(245,158,11,0.14)]"
        )}
        style={{ ...fillStyle, backgroundImage: meterGradient }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.16]"
        style={{
          backgroundImage:
            orientation === "vertical"
              ? "repeating-linear-gradient(to top, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 2px, transparent 2px, transparent 8px)"
              : "repeating-linear-gradient(to right, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 2px, transparent 2px, transparent 8px)",
        }}
      />
      {showPeak && (
        <div
          className={cn(
            "absolute",
            orientation === "vertical" ? "left-0 w-full h-[2px]" : "top-0 h-full w-[2px]",
            "bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]"
          )}
          style={peakStyle}
        />
      )}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[length:100%_6px]" />
    </div>
  );
}

export type AstutelyFaderProps = {
  label?: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  orientation?: Orientation;
  tone?: AstutelyTone;
  className?: string;
  sliderClassName?: string;
  heightClassName?: string;
  showValue?: boolean;
  disabled?: boolean;
};

export function AstutelyFader({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  orientation = "horizontal",
  tone: toneName = "cyan",
  className,
  sliderClassName,
  heightClassName,
  showValue = true,
  disabled,
}: AstutelyFaderProps) {
  const t = tone(toneName);
  const v = clamp(value, min, max);

  const onSlider = React.useCallback(
    (arr: number[]) => {
      const next = clamp(arr[0] ?? min, min, max);
      onValueChange(next);
    },
    [min, max, onValueChange]
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-black/70 backdrop-blur-md px-3 py-2",
        t.border,
        t.glow,
        className
      )}
    >
      {label && (
        <div className="flex flex-col gap-1 min-w-[90px]">
          <span className={cn("text-[10px] font-black uppercase tracking-widest", t.softText)}>{label}</span>
          {showValue && <span className={cn("text-xs font-black tabular-nums", t.text)}>{Math.round(v)}</span>}
        </div>
      )}

      <div className={cn("relative", orientation === "vertical" ? "flex items-center" : "flex-1")}>
        <div
          className={cn(
            orientation === "vertical" ? heightClassName ?? "h-28" : "w-full",
            "relative"
          )}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.25]"
            style={{
              backgroundImage:
                orientation === "vertical"
                  ? "repeating-linear-gradient(to top, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 10px)"
                  : "repeating-linear-gradient(to right, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 10px)",
            }}
          />
          <Slider
            value={[v]}
            onValueChange={onSlider}
            min={min}
            max={max}
            step={step}
            orientation={orientation}
            disabled={disabled}
            className={cn(orientation === "vertical" ? "h-full" : "w-full", sliderClassName)}
          />
        </div>
      </div>
    </div>
  );
}
