import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/lib/queryClient";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  tier: string;
  monthlyUploads: number;
  monthlyGenerations: number;
  lastUsageReset?: string;
  isAuthenticated?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  subscription?: SubscriptionStatus;
  isAuthenticated: boolean;
  isPro: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [subscription, setSubscription] =
    useState<SubscriptionStatus | undefined>(undefined);

  const fetchSubscription = useCallback(async () => {
    setStatus((prev) => (prev === "loading" ? prev : "loading"));
    try {
      const response = await apiRequest("GET", "/api/subscription-status");
      const data = (await response.json()) as SubscriptionStatus;
      setSubscription(data);
      // Only treat as authenticated if backend marks user as authenticated
      setStatus(data.isAuthenticated ? "authenticated" : "unauthenticated");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("401")) {
        setSubscription(undefined);
        setStatus("unauthenticated");
        return;
      }
      // Handle server errors gracefully - don't expose to user
      console.warn("Subscription service unavailable, using defaults");
      setSubscription({
        hasActiveSubscription: false,
        tier: "free",
        monthlyUploads: 0,
        monthlyGenerations: 0
      });
      setStatus("authenticated"); // Allow app to function normally
    }
  }, []);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      subscription,
      isAuthenticated: status === "authenticated",
      isPro:
        subscription?.tier === "pro" || subscription?.hasActiveSubscription === true,
      refresh: fetchSubscription,
    }),
    [fetchSubscription, status, subscription],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
