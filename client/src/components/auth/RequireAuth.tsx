import { ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface RequireAuthProps {
  children: ReactNode;
  requirePro?: boolean;
  title?: string;
  description?: string;
  ctaLabel?: string;
  proCtaLabel?: string;
}

export function RequireAuth({
  children,
  requirePro = false,
  title,
  description,
  ctaLabel,
  proCtaLabel,
}: RequireAuthProps) {
  const { status, isAuthenticated, isPro } = useAuth();
  const [, navigate] = useLocation();

  // 🔓 DEV MODE: Bypass auth checks on localhost
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // 🧪 TESTING MODE: Also bypass auth in production for testing (REMOVE BEFORE REAL LAUNCH)
  const isTesting = true; // SET TO FALSE when you want real auth
  
  if (isDev || isTesting) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your access…
        </div>
      </div>
    );
  }

  const unlocked = isAuthenticated && (!requirePro || isPro);

  if (unlocked) {
    return <>{children}</>;
  }

  const heading =
    title || (requirePro ? "Upgrade to unlock this studio" : "Sign in to continue");
  const body =
    description ||
    (requirePro
      ? "This tool includes premium AI workflows. Upgrade your plan to keep using it without limits."
      : "Create a free account or sign in to unlock saves, AI features, and personalized content.");

  const primaryCtaLabel = ctaLabel || (isAuthenticated ? "Upgrade plan" : "Sign in or create account");
  const secondaryCtaLabel = proCtaLabel || (requirePro ? "View plans" : "Explore features");

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md border border-gray-700 bg-studio-panel text-left">
        <CardHeader className="space-y-4">
          <Lock className="h-6 w-6 text-studio-accent" />
          <div>
            <CardTitle className="text-xl font-semibold">{heading}</CardTitle>
            <CardDescription className="text-sm text-gray-300">{body}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-300">
          <div className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800/70 px-3 py-2">
            <Lock className="h-4 w-4 text-studio-accent" />
            <span>
              {requirePro
                ? "Pro plans unlock AI assistance, MusicGen, and premium exports."
                : "Free accounts keep your projects synced and unlock AI assistants."}
            </span>
          </div>
          {requirePro && (
            <div className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800/70 px-3 py-2">
              <Crown className="h-4 w-4 text-yellow-400" />
              <span>Upgrade once. Keep every generated song, beat, and analysis.</span>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-sm">
          <Button
            onClick={() => navigate(isAuthenticated ? "/subscribe" : "/dashboard")}
            className="w-full bg-studio-accent hover:bg-blue-500"
          >
            {primaryCtaLabel}
          </Button>
          <Button
            onClick={() => navigate(requirePro ? "/subscribe" : "/")}
            variant="outline"
            className="w-full border-gray-700 text-gray-200 hover:bg-gray-800"
          >
            {secondaryCtaLabel}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
