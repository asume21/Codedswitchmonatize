import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, orientation = "horizontal", value, defaultValue, ...props }, ref) => {
  const isVertical = orientation === "vertical";
  // Normalize value/defaultValue to arrays for Radix Slider
  const normalizedValue = Array.isArray(value) ? value : value != null ? [value] : undefined;
  const normalizedDefaultValue = Array.isArray(defaultValue) ? defaultValue : defaultValue != null ? [defaultValue] : undefined;
  
  return (
    <SliderPrimitive.Root
      ref={ref}
      orientation={orientation}
      value={normalizedValue}
      defaultValue={normalizedDefaultValue}
      className={cn(
        "astutely-slider relative flex touch-none select-none items-center",
        isVertical ? "h-full w-3 flex-col" : "w-full",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className={cn(
        "relative grow overflow-hidden rounded-full bg-black/70 border border-cyan-500/20 shadow-[inset_0_0_12px_rgba(6,182,212,0.12)]",
        isVertical ? "w-3 h-full" : "h-2.5 w-full"
      )}>
        <SliderPrimitive.Range className={cn(
          "absolute bg-gradient-to-r from-cyan-600 via-cyan-400 to-white shadow-[0_0_16px_rgba(6,182,212,0.45)]",
          isVertical ? "w-full" : "h-full"
        )} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block h-5 w-5 rounded-full border-2 border-cyan-400 bg-white shadow-[0_0_18px_rgba(6,182,212,0.6)] ring-offset-black transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      />
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
