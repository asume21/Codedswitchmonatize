import { useState } from "react";
import { cn } from "@/lib/utils";

interface AutoHideSidebarProps {
  children: React.ReactNode;
}

export function AutoHideSidebar({ children }: AutoHideSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hover trigger rail - slim zone on left edge */}
      <div
        className="fixed left-0 top-0 h-full w-6 z-40"
        onMouseEnter={() => setIsOpen(true)}
        data-testid="sidebar-trigger-rail"
      />

      {/* Sidebar container */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full z-50 transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0 drop-shadow-2xl" : "translate-x-[-100%]"
        )}
        onMouseLeave={() => setIsOpen(false)}
        data-testid="auto-hide-sidebar"
      >
        {children}
      </div>

      {/* Overlay backdrop when sidebar is open (optional, for better UX) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}
    </>
  );
}
