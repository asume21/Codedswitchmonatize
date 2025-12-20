import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

type ProFeature = "export" | "save" | "ai" | "ai-chords" | "track-limit";
type LicenseStatus = "unknown" | "checking" | "active" | "inactive" | "error";

interface LicenseCheckResponse {
  isPro: boolean;
  status?: string;
  currentPeriodEnd?: string | null;
}

class LicenseGuard {
  private initializing: Promise<boolean> | null = null;
  private listeners: Array<(isPro: boolean, status: LicenseStatus) => void> = [];
  public isPro = false;
  public status: LicenseStatus = "unknown";
  public currentPeriodEnd: string | null = null;

  initialize(): Promise<boolean> {
    if (this.initializing) return this.initializing;
    this.initializing = this.refresh();
    return this.initializing;
  }

  async refresh(): Promise<boolean> {
    this.setStatus(this.isPro, "checking");
    try {
      const res = await apiRequest("GET", "/api/check-license");
      const data = (await res.json()) as LicenseCheckResponse;
      const nextStatus: LicenseStatus = data.isPro
        ? "active"
        : data.status === "error"
          ? "error"
          : "inactive";
      this.currentPeriodEnd = data.currentPeriodEnd ?? null;
      this.setStatus(Boolean(data.isPro), nextStatus);
      return Boolean(data.isPro);
    } catch (error) {
      console.error("License validation failed:", error);
      this.setStatus(false, "error");
      return false;
    } finally {
      this.initializing = null;
    }
  }

  private setStatus(valid: boolean, status: LicenseStatus) {
    this.isPro = valid;
    this.status = status;
    this.listeners.forEach((listener) => listener(this.isPro, this.status));
  }

  onChange(listener: (isPro: boolean, status: LicenseStatus) => void): () => void {
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

  async startCheckout(): Promise<void> {
    try {
      console.log("🛒 Starting checkout...");
      const res = await apiRequest("POST", "/api/create-checkout");
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Checkout failed:", res.status, errorData);
        throw new Error(errorData.error || `Checkout failed: ${res.status}`);
      }
      
      const data = await res.json();
      console.log("🛒 Checkout response:", data);
      
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (error) {
      console.error("🛒 Checkout error:", error);
      throw error;
    }
  }
}

export const licenseGuard = new LicenseGuard();

export function useLicenseGate() {
  const [isPro, setIsPro] = useState<boolean>(licenseGuard.isPro);
  const [status, setStatus] = useState<LicenseStatus>(licenseGuard.status);

  useEffect(() => {
    let mounted = true;
    licenseGuard.initialize().then((valid) => {
      if (mounted) {
        setIsPro(valid);
        setStatus(licenseGuard.status);
      }
    });
    const unsubscribe = licenseGuard.onChange((next, nextStatus) => {
      setIsPro(next);
      setStatus(nextStatus);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const requirePro = (feature: ProFeature, onBlocked?: () => void) =>
    licenseGuard.requirePro(feature, onBlocked);

  const startUpgrade = () => licenseGuard.startCheckout();
  const refresh = () => licenseGuard.refresh();

  return {
    isPro,
    status,
    isChecking: status === "checking",
    requirePro,
    startUpgrade,
    refresh,
  };
}

export function UpgradeModal({
  open,
  onClose,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade?: () => Promise<void>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (onUpgrade) {
        await onUpgrade();
      } else {
        await licenseGuard.startCheckout();
      }
    } catch (err: any) {
      console.error("Upgrade failed:", err);
      setError(err?.message || "Failed to start checkout. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-xl font-semibold text-white mb-3">Upgrade to Pro</h3>
        <p className="text-sm text-gray-300 mb-4">
          This feature requires an active subscription. Unlock exports, project saves, AI
          generation, and unlimited tracks by upgrading your plan.
        </p>
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded bg-gray-800 text-gray-200 hover:bg-gray-700"
            disabled={isLoading}
          >
            Close
          </button>
          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-70"
          >
            {isLoading ? "Redirecting..." : "Upgrade Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
