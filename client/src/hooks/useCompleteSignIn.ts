import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, type SubscriptionStatus } from "@/contexts/AuthContext";

const SUBSCRIPTION_QUERY_KEY = ["/api/subscription-status"] as const;

/**
 * Finish a successful sign-in or sign-up: store the token, seed the auth cache
 * so the very next route guard already sees the user as signed in, then
 * refresh it from the server.
 *
 * Login did this; signup didn't — it navigated with the cached "signed out"
 * status still in place, so ProtectedRoute bounced every brand-new account to
 * /login (found 2026-10-07 while testing the post-signup redirect). One shared
 * routine for both pages (password and Google) so they can't drift again.
 */
export function useCompleteSignIn() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();

  return useCallback(
    (data: any, state: "login" | "signup" | "google-login") => {
      if (data?.token) localStorage.setItem("authToken", data.token);
      if (data?.userId) localStorage.setItem("authUserId", data.userId);
      window.dispatchEvent(new CustomEvent("codedswitch:auth-changed", { detail: { state } }));

      const user = data?.user ?? {};
      queryClient.setQueryData<SubscriptionStatus>(SUBSCRIPTION_QUERY_KEY, {
        hasActiveSubscription: user.subscriptionTier === "pro" || user.subscriptionStatus === "active",
        tier: user.subscriptionTier || "free",
        monthlyUploads: user.monthlyUploads || 0,
        monthlyGenerations: user.monthlyGenerations || 0,
        lastUsageReset: user.lastUsageReset,
        isAuthenticated: true,
        userId: data?.userId ?? user.id,
      });

      void refresh().catch((err) => console.warn("Post-sign-in auth refresh failed:", err));
    },
    [queryClient, refresh],
  );
}
