import { useAuth } from "@/contexts/AuthContext";
import { Lock, Music, Sparkles } from "lucide-react";

/**
 * Frosted glass overlay for unauthenticated users visiting the studio.
 * Shows the studio UI behind it (teaser mode) while blocking interaction.
 */
export function TeaserOverlay() {
  const { isAuthenticated, status } = useAuth();

  // Don't show while loading or if authenticated
  if (status === "loading" || isAuthenticated) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-2xl border border-cyan-500/40 bg-black/80 backdrop-blur-xl shadow-[0_0_40px_rgba(6,182,212,0.2)]">
        {/* Scanline overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_2px]" />

        <div className="relative p-8 text-center space-y-6">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center shadow-[0_0_24px_rgba(6,182,212,0.25)]">
            <Lock className="w-7 h-7 text-cyan-300" />
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-2xl font-bold text-cyan-50 tracking-tight">
              Create Your Free Account
            </h2>
            <p className="mt-2 text-sm text-cyan-300/70 leading-relaxed">
              Sign up to start making music with AI-powered tools, beats, and more.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-950/30 px-4 py-2.5">
              <Music className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-sm text-cyan-200/80">Full studio with beat maker, piano roll, and mixer</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-950/30 px-4 py-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-sm text-cyan-200/80">10 free AI credits to generate beats, lyrics, and melodies</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <a
              href="/signup"
              className="inline-flex items-center justify-center h-11 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-6 text-sm font-bold tracking-wide text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:from-cyan-500 hover:to-cyan-400 transition-all duration-200"
            >
              Sign Up Free
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center h-10 rounded-xl border border-cyan-500/30 bg-black/50 px-6 text-sm font-medium text-cyan-200 hover:bg-cyan-500/10 transition-all duration-200"
            >
              Already have an account? Log in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
