import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music, Loader2 } from "lucide-react";
import { useAuth, type SubscriptionStatus } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const SUBSCRIPTION_QUERY_KEY = ["/api/subscription-status"] as const;

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Could not reach the server. Make sure the API is running and try again.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Invalid email or password";
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      // Safely parse JSON — server may return empty body on error
      let data: any;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || `Login failed (${response.status})`);
      }

      // Store auth token for subsequent requests
      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }
      if (data.userId) {
        localStorage.setItem('authUserId', data.userId);
      }

      // Login succeeded. Seed auth immediately so a slow subscription refresh
      // cannot turn a successful login into a "Login Failed" toast.
      queryClient.setQueryData<SubscriptionStatus>(SUBSCRIPTION_QUERY_KEY, {
        hasActiveSubscription:
          data.user?.subscriptionTier === "pro" || data.user?.subscriptionStatus === "active",
        tier: data.user?.subscriptionTier || "free",
        monthlyUploads: data.user?.monthlyUploads || 0,
        monthlyGenerations: data.user?.monthlyGenerations || 0,
        lastUsageReset: data.user?.lastUsageReset,
        isAuthenticated: true,
      });

      // Re-fetch exact subscription usage in the background. This must not
      // decide whether the login itself succeeded.
      void refresh().catch((refreshError) => {
        console.warn("Post-login auth refresh failed:", refreshError);
      });

      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });

      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: getLoginErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 overflow-y-auto"
      style={{ minHeight: '100dvh' }}
    >
      <Card className="w-full max-w-md bg-gray-900 border-gray-700">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
              <Music className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Welcome Back</CardTitle>
          <CardDescription className="text-gray-400">
            Sign in to your CodedSwitch account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-200">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <div className="text-center text-sm text-gray-400">
              Don't have an account?{" "}
              <a href="/signup" className="text-blue-400 hover:text-blue-300 underline">
                Sign up
              </a>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
