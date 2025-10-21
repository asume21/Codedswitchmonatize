import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, orientation = "horizontal", ...props }, ref) => {
  const isVertical = orientation === "vertical";
  
  return (
    <SliderPrimitive.Root
      ref={ref}
      orientation={orientation}
      className={cn(
        "relative flex touch-none select-none items-center",
        isVertical ? "h-full w-2 flex-col" : "w-full",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className={cn(
        "relative grow overflow-hidden rounded-full bg-gray-700",
        isVertical ? "w-2 h-full" : "h-2 w-full"
      )}>
        <SliderPrimitive.Range className={cn(
          "absolute bg-blue-500",
          isVertical ? "w-full" : "h-full"
        )} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-white bg-white shadow-lg ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
