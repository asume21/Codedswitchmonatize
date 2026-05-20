import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import AstutelyChatbot from "@/components/ai/AstutelyChatbot";

interface AssistantOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ⌘K AI Assistant overlay. Renders the existing AstutelyChatbot in `embedded`
 * mode inside a slide-in Sheet so the same React instance keeps owning the
 * conversation state — there's no separate message store to sync. Closing the
 * overlay simply unmounts the Sheet; the chatbot's internal state is rebuilt
 * on next open (matching the current behavior of the floating chatbot when it
 * remounts elsewhere in the app).
 */
export default function AssistantOverlay({ open, onClose }: AssistantOverlayProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        data-testid="studio-shell-overlay-assistant"
        className={cn(
          // Wider than shadcn default; transparent background so the chatbot's
          // own glassmorphism Card is the visible surface.
          "w-full sm:max-w-[640px] sm:w-[640px] p-0 gap-0",
          "bg-transparent border-l-0 shadow-none",
          // Hide shadcn Sheet's built-in close button — the chatbot's header
          // provides its own. Targets the SheetContent's direct <button> child
          // (Radix Close), which is the only top-level <button> rendered here.
          "[&>button.absolute]:hidden"
        )}
      >
        <AstutelyChatbot embedded onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}
