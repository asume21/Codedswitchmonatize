import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "astutely-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-cyan-600/20 text-cyan-100 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.18)] hover:bg-cyan-500/25 hover:text-white",
        destructive:
          "bg-red-500/20 text-red-100 border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.18)] hover:bg-red-500/25 hover:text-white",
        outline:
          "border border-cyan-500/40 bg-black/60 text-cyan-100 hover:bg-cyan-500/15",
        secondary:
          "bg-cyan-950/40 text-cyan-100 border border-cyan-500/25 hover:bg-cyan-500/15",
        ghost: "text-cyan-100 hover:bg-cyan-500/15",
        link: "text-cyan-300 underline-offset-4 hover:underline hover:text-cyan-200",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
