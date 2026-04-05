import { type ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  /** If true, shows a teaser overlay instead of redirecting (for studio) */
  teaserMode?: boolean;
}

/**
 * Route-level auth guard. Redirects unauthenticated users to /login.
 * Use `teaserMode` for routes where you want to show the UI behind a lock overlay.
 */
export function ProtectedRoute({ children, teaserMode }: ProtectedRouteProps) {
  const { status, isAuthenticated } = useAuth();

  // Still checking auth — show loading spinner
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-black/95 text-cyan-100">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.25)]" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-cyan-300/10 border-t-cyan-300 border-r-cyan-300/40" />
          </div>
          <p className="text-cyan-200/70 font-bold tracking-widest uppercase text-xs">
            Checking access…
          </p>
        </div>
      </div>
    );
  }

  // Authenticated — render children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Teaser mode: render children with overlay (handled by TeaserOverlay inside the page)
  if (teaserMode) {
    return <>{children}</>;
  }

  // Not authenticated — redirect to login
  return <Redirect to="/login" />;
}
