// "Continue with Google" — Google Identity Services (GIS) button.
// Spec: docs/superpowers/specs/2026-07-03-google-login-design.md
//
// Renders NOTHING when VITE_GOOGLE_CLIENT_ID is unset, so environments
// without Google configured (dev, previews) are completely unaffected.

import { useEffect, useRef, useState } from "react";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let gisLoader: Promise<void> | null = null;
function loadGis(): Promise<void> {
  gisLoader ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
  return gisLoader;
}

interface GoogleSignInButtonProps {
  /** Receives the parsed /api/auth/google response body on success. */
  onSuccess: (data: any) => void;
  onError: (message: string) => void;
}

export default function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // The callbacks live in a ref so the GIS initialize (run once) always calls
  // the latest handlers without re-initializing on every render.
  const handlersRef = useRef({ onSuccess, onError });
  handlersRef.current = { onSuccess, onError };

  useEffect(() => {
    if (!CLIENT_ID || !containerRef.current) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            try {
              const response = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential }),
                credentials: "include",
              });
              const text = await response.text();
              let data: any = {};
              try { data = text ? JSON.parse(text) : {}; } catch { /* empty error body */ }
              if (!response.ok) {
                throw new Error(data.message || `Google login failed (${response.status})`);
              }
              handlersRef.current.onSuccess(data);
            } catch (error: any) {
              handlersRef.current.onError(error?.message || "Google login failed");
            }
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          width: 352, // max-w-md card interior — GIS wants a px width
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, []);

  // Not configured or script blocked: render nothing — password login stands alone.
  if (!CLIENT_ID || failed) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <div className="h-px flex-1 bg-gray-700" />
        <span className="text-xs text-gray-500">or</span>
        <div className="h-px flex-1 bg-gray-700" />
      </div>
      <div ref={containerRef} className="flex justify-center pt-2" data-testid="google-signin" />
    </div>
  );
}
