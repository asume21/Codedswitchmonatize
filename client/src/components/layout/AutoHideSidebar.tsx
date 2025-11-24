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
        onFocus={() => setIsOpen(true)}
        tabIndex={0}
        role="button"
        aria-label="Open sidebar"
        aria-expanded={isOpen}
        onKeyDown={(e) => e.key === 'Enter' && setIsOpen(true)}
        data-testid="sidebar-trigger-rail"
      />

      {/* Backdrop when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar container */}
      <nav
        className={cn(
          "fixed left-0 top-0 h-full w-64 z-50 transition-transform duration-300 ease-out drop-shadow-2xl",
          isOpen ? "translate-x-0" : "translate-x-[-100%]"
        )}
        onMouseLeave={() => setIsOpen(false)}
        aria-label="Main navigation"
        aria-hidden={!isOpen}
        data-testid="auto-hide-sidebar"
      >
        <div className="h-full bg-gray-950 border-r border-gray-800">
          {children}
        </div>
      </nav>
    </>
  );
}
