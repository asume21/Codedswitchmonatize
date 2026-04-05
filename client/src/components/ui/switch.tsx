import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // OFF state
      "border-zinc-600 bg-zinc-800/80",
      // ON state
      "data-[state=checked]:border-cyan-500/60 data-[state=checked]:bg-cyan-600/20 data-[state=checked]:shadow-[0_0_12px_rgba(6,182,212,0.3)]",
      className
    )}
    {...props}
    ref={ref}
  >
    {/* OFF label */}
    <span
      className="absolute right-2 select-none text-[9px] font-bold uppercase tracking-wider text-zinc-400 transition-opacity duration-200 data-[state=checked]:opacity-0"
      data-state={props.checked ? "checked" : "unchecked"}
      aria-hidden
    >
      Off
    </span>
    {/* ON label */}
    <span
      className="absolute left-1.5 select-none text-[9px] font-bold uppercase tracking-wider text-cyan-300 transition-opacity duration-200 data-[state=unchecked]:opacity-0"
      data-state={props.checked ? "checked" : "unchecked"}
      aria-hidden
    >
      On
    </span>
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-all duration-200",
        "translate-x-1 bg-zinc-400",
        "data-[state=checked]:translate-x-8 data-[state=checked]:bg-cyan-400 data-[state=checked]:shadow-[0_0_8px_rgba(6,182,212,0.5)]"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
