import { Zap } from "lucide-react";
import {
  CREDIT_COSTS,
  CREDIT_OPERATION_LABELS,
  type CreditOperation,
} from "@shared/creditCosts";
import { cn } from "@/lib/utils";

interface CreditBadgeProps {
  /** Named operation (preferred — pulls cost + label from the shared map). */
  operation?: CreditOperation;
  /** Raw cost override — use only when the operation isn't in the shared map. */
  cost?: number;
  /** Optional custom label; defaults to the operation's canonical label. */
  label?: string;
  /** Visual weight: "inline" sits next to a button, "pill" is a standalone chip. */
  variant?: "inline" | "pill";
  className?: string;
}

export function CreditBadge({
  operation,
  cost,
  label,
  variant = "inline",
  className,
}: CreditBadgeProps) {
  const resolvedCost = cost ?? (operation ? CREDIT_COSTS[operation] : 0);
  const resolvedLabel =
    label ?? (operation ? CREDIT_OPERATION_LABELS[operation] : undefined);

  if (resolvedCost <= 0) return null;

  const title = resolvedLabel
    ? `${resolvedLabel} — ${resolvedCost} credit${resolvedCost === 1 ? "" : "s"}`
    : `${resolvedCost} credit${resolvedCost === 1 ? "" : "s"}`;

  const base =
    "inline-flex items-center gap-1 font-medium text-cyan-300/90 whitespace-nowrap";
  const sized =
    variant === "pill"
      ? "px-2 py-0.5 text-xs rounded-full border border-cyan-500/40 bg-cyan-950/40"
      : "text-xs";

  return (
    <span className={cn(base, sized, className)} title={title}>
      <Zap className="h-3 w-3 shrink-0" />
      <span>{resolvedCost}</span>
    </span>
  );
}

export default CreditBadge;
