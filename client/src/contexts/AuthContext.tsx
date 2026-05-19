import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";

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

const SUBSCRIPTION_QUERY_KEY = ["/api/subscription-status"] as const;
const AUTH_CHECK_TIMEOUT_MS = 5_000;

const UNAUTHENTICATED_FALLBACK: SubscriptionStatus = {
  hasActiveSubscription: false,
  tier: "free",
  monthlyUploads: 0,
  monthlyGenerations: 0,
  isAuthenticated: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: async ({ signal }) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        // Keep each auth check bounded so transient failures can retry.
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new ApiError(0, "Auth check timed out")),
            AUTH_CHECK_TIMEOUT_MS,
          );
        });
        const response = await Promise.race([
          apiRequest("GET", "/api/subscription-status", undefined, { signal }),
          timeout,
        ]);
        return (await response.json()) as SubscriptionStatus;
      } catch (error) {
        if (error instanceof ApiError && error.isAuthError) {
          return UNAUTHENTICATED_FALLBACK;
        }
        throw error;
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.isAuthError) return false;
      return failureCount < 2;
    },
  });

  const subscription = data;

  const status: AuthStatus = isLoading
    ? "loading"
    : subscription?.isAuthenticated === true
      ? "authenticated"
      : subscription?.isAuthenticated === false
        ? "unauthenticated"
        : "loading";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      subscription,
      isAuthenticated: status === "authenticated",
      isPro:
        subscription?.tier === "pro" || subscription?.hasActiveSubscription === true,
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      },
    }),
    [queryClient, status, subscription],
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
