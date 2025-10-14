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
      setStatus("authenticated");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("401")) {
        setSubscription(undefined);
        setStatus("unauthenticated");
        return;
      }
      console.error("Failed to load subscription status", error);
      setSubscription(undefined);
      setStatus("unauthenticated");
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
