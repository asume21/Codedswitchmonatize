import { useEffect, useState } from "react";

type ProFeature = "export" | "save" | "ai-chords" | "track-limit";

// Strict, browser-only validator; replace with server-backed verification for production.
const validateLicense = async (key: string, expected: string): Promise<boolean> => {
  // If an expected key is provided, require an exact match (no length-based bypass)
  if (expected && key !== expected) return false;

  // If you also want a hash check, keep this; otherwise exact match is enough.
  const data = new TextEncoder().encode(key + "codedswitch-salt-2025");
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Replace this hash with a real one, or drop it once server validation is in place.
  return (
    hashHex ===
    "a1b2c3d4e5f6789012345678901234567890123456789012345678901234"
  );
};

class LicenseGuard {
  private initializing: Promise<boolean> | null = null;
  private listeners: Array<(isPro: boolean) => void> = [];
  public isPro = false;
  public status: "unknown" | "valid" | "invalid" = "unknown";

  initialize(): Promise<boolean> {
    if (this.initializing) return this.initializing;
    this.initializing = this.validate();
    return this.initializing;
  }

  private async validate(): Promise<boolean> {
    try {
      const envKey =
        ((import.meta as any).env?.VITE_LICENSE_KEY as string | undefined) || "";
      const storedKey =
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("licenseKey")) ||
        "";

      // No key or no expected key -> invalid
      if (!storedKey || !envKey) {
        this.setStatus(false);
        return false;
      }

      let valid = false;

      // Cryptlex validation disabled - using local validation only
      // The cryptlex package is not available in browser environments

      // Fallback: exact match + hash guard
      if (!valid) {
        valid = await validateLicense(storedKey, envKey);
      }

      this.setStatus(valid);
      return valid;
    } catch (error) {
      console.error("License validation failed:", error);
      this.setStatus(false);
      return false;
    }
  }

  private setStatus(valid: boolean) {
    this.isPro = valid;
    this.status = valid ? "valid" : "invalid";
    this.listeners.forEach((listener) => listener(this.isPro));
  }

  onChange(listener: (isPro: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  requirePro(feature: ProFeature, onBlocked?: () => void): boolean {
    if (this.isPro) return true;
    onBlocked?.();
    console.warn(`Blocked pro feature: ${feature}`);
    return false;
  }
}

export const licenseGuard = new LicenseGuard();

export function useLicenseGate() {
  const [isPro, setIsPro] = useState<boolean>(licenseGuard.isPro);
  const [status, setStatus] = useState<"unknown" | "valid" | "invalid">(licenseGuard.status);

  useEffect(() => {
    let mounted = true;
    licenseGuard.initialize().then((valid) => {
      if (mounted) {
        setIsPro(valid);
        setStatus(valid ? "valid" : "invalid");
      }
    });
    const unsubscribe = licenseGuard.onChange((next) => {
      setIsPro(next);
      setStatus(next ? "valid" : "invalid");
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const requirePro = (feature: ProFeature, onBlocked?: () => void) =>
    licenseGuard.requirePro(feature, onBlocked);

  return { isPro, status, requirePro };
}

export function UpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-xl font-semibold text-white mb-3">Upgrade to Pro</h3>
        <p className="text-sm text-gray-300 mb-4">
          This feature requires a valid Pro license. Unlock exports, project saves, AI chord
          generation, and unlimited tracks by upgrading your plan.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded bg-gray-800 text-gray-200 hover:bg-gray-700"
          >
            Close
          </button>
          <a
            href="/subscribe"
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-500"
          >
            Upgrade Now
          </a>
        </div>
      </div>
    </div>
  );
}
