import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins, Zap, Crown, Building2, Check, Loader2,
  Music, Mic, Sparkles, ArrowLeft,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ── Data ────────────────────────────────────────

interface MembershipTier {
  key: string;
  name: string;
  price: number;
  monthlyCredits: number;
  rolloverMax: number;
  features: string[];
  badge?: string;
  highlighted?: boolean;
  icon: typeof Zap;
}

interface CreditPack {
  key: string;
  credits: number;
  price: number;
  savings?: string;
  badge?: string;
}

const membershipTiers: MembershipTier[] = [
  {
    key: "CREATOR",
    name: "Creator",
    price: 9.99,
    monthlyCredits: 200,
    rolloverMax: 400,
    icon: Zap,
    features: [
      "200 credits per month",
      "Credits rollover (max 400)",
      "Priority support",
      "No ads",
      "Premium templates",
    ],
  },
  {
    key: "PRO",
    name: "Pro",
    price: 29.99,
    monthlyCredits: 750,
    rolloverMax: 1500,
    icon: Crown,
    badge: "Most Popular",
    highlighted: true,
    features: [
      "750 credits per month",
      "Credits rollover (max 1500)",
      "Commercial license",
      "Advanced AI models",
      "Priority queue",
      "API access",
    ],
  },
  {
    key: "STUDIO",
    name: "Studio",
    price: 79.99,
    monthlyCredits: 2500,
    rolloverMax: 5000,
    icon: Building2,
    badge: "Enterprise",
    features: [
      "2500 credits per month",
      "Credits rollover (max 5000)",
      "Team collaboration (5 seats)",
      "Dedicated support",
      "Custom integrations",
      "White-label branding",
    ],
  },
];

const creditPacks: CreditPack[] = [
  { key: "STARTER", credits: 100, price: 4.99 },
  { key: "POPULAR", credits: 500, price: 19.99, savings: "20%", badge: "Popular" },
  { key: "PRO", credits: 1000, price: 34.99, savings: "30%", badge: "Best Value" },
  { key: "ENTERPRISE", credits: 5000, price: 149.99, savings: "40%" },
];

const creditUsage = [
  { action: "Full Song Generation", cost: 25, icon: Music },
  { action: "Beat Generation", cost: 5, icon: Zap },
  { action: "Lyrics Generation", cost: 4, icon: Mic },
  { action: "Instrumental", cost: 8, icon: Music },
  { action: "Melody Generation", cost: 5, icon: Sparkles },
  { action: "Lyrics Analysis", cost: 2, icon: Mic },
];

// ── Component ───────────────────────────────────

export default function PricingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const { data: creditData } = useQuery({
    queryKey: ["/api/credits/balance"],
    queryFn: () => apiRequest("GET", "/api/credits/balance").then((r) => r.json()),
    enabled: isAuthenticated,
  });

  const membershipMutation = useMutation({
    mutationFn: async (tierKey: string) => {
      const res = await apiRequest("POST", "/api/credits/membership-checkout", { tierKey });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
      setPurchasing(null);
    },
    onError: (error: any) => {
      toast({ title: "Checkout Failed", description: error.message || "Please try again.", variant: "destructive" });
      setPurchasing(null);
    },
  });

  const packMutation = useMutation({
    mutationFn: async (packageKey: string) => {
      const res = await apiRequest("POST", "/api/credits/purchase-checkout", { packageKey });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
      setPurchasing(null);
    },
    onError: (error: any) => {
      toast({ title: "Purchase Failed", description: error.message || "Please try again.", variant: "destructive" });
      setPurchasing(null);
    },
  });

  const handleMembership = (key: string) => {
    if (!isAuthenticated) { navigate("/signup"); return; }
    setPurchasing(key);
    membershipMutation.mutate(key);
  };

  const handlePack = (key: string) => {
    if (!isAuthenticated) { navigate("/signup"); return; }
    setPurchasing(key);
    packMutation.mutate(key);
  };

  return (
    <div className="min-h-screen bg-black/95 text-cyan-100">
      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="text-cyan-300/70 hover:text-cyan-100"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* ── Header ── */}
      <div className="text-center pt-8 pb-10 px-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-cyan-50">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-2 text-cyan-400/70 text-base sm:text-lg">
          Start free with 10 credits. Upgrade when you're ready.
        </p>
        {isAuthenticated && creditData && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-950/30">
            <Coins className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium">
              Current balance: <span className="text-cyan-200 font-bold">{creditData.balance ?? 0}</span> credits
            </span>
          </div>
        )}
      </div>

      {/* ── Membership Tiers ── */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {membershipTiers.map((tier) => (
            <div
              key={tier.key}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                tier.highlighted
                  ? "border-cyan-400/60 bg-cyan-950/20 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                  : "border-cyan-500/20 bg-black/40"
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-cyan-600 text-white text-xs px-3 py-0.5 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                    {tier.badge}
                  </Badge>
                </div>
              )}

              {/* Icon + name */}
              <div className="flex items-center gap-3 mb-4 mt-1">
                <div className={`p-2.5 rounded-xl ${
                  tier.highlighted
                    ? "bg-cyan-500/20 border border-cyan-500/40"
                    : "bg-cyan-950/40 border border-cyan-500/20"
                }`}>
                  <tier.icon className="h-5 w-5 text-cyan-300" />
                </div>
                <h3 className="text-xl font-bold text-cyan-50">{tier.name}</h3>
              </div>

              {/* Price */}
              <div className="mb-1">
                <span className="text-4xl font-bold text-white">${tier.price}</span>
                <span className="text-cyan-400/60 text-sm ml-1">/month</span>
              </div>
              <div className="text-sm text-cyan-400/70 mb-6">
                {tier.monthlyCredits} credits/mo · rollover up to {tier.rolloverMax}
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span className="text-cyan-200/80">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                onClick={() => handleMembership(tier.key)}
                disabled={purchasing === tier.key}
                className={`w-full h-11 font-semibold transition-all ${
                  tier.highlighted
                    ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-[0_0_16px_rgba(6,182,212,0.3)] hover:shadow-[0_0_24px_rgba(6,182,212,0.5)] hover:from-cyan-500 hover:to-cyan-400"
                    : "bg-cyan-600/15 border border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/25"
                }`}
              >
                {purchasing === tier.key ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</>
                ) : (
                  isAuthenticated ? `Subscribe to ${tier.name}` : "Sign Up to Subscribe"
                )}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ── One-Time Credit Packs ── */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-cyan-50">Need Credits Without a Subscription?</h2>
          <p className="text-sm text-cyan-400/60 mt-1">Buy one-time packs anytime</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {creditPacks.map((pack) => (
            <button
              key={pack.key}
              onClick={() => handlePack(pack.key)}
              disabled={purchasing === pack.key}
              className={`relative flex flex-col items-center rounded-xl border p-5 transition-all hover:border-cyan-400/50 hover:shadow-[0_0_16px_rgba(6,182,212,0.1)] ${
                pack.badge
                  ? "border-cyan-500/40 bg-cyan-950/15"
                  : "border-cyan-500/15 bg-black/30"
              }`}
            >
              {pack.badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-600/30 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                    {pack.badge}
                  </span>
                </div>
              )}

              <Coins className="h-6 w-6 text-cyan-400 mb-2" />
              <div className="text-2xl font-bold text-white">{pack.credits}</div>
              <div className="text-xs text-cyan-400/60 mb-3">credits</div>
              <div className="text-lg font-bold text-cyan-100">${pack.price}</div>
              {pack.savings && (
                <div className="text-xs text-green-400 mt-1">Save {pack.savings}</div>
              )}

              {purchasing === pack.key && (
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300 mt-2" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Credit Usage Breakdown ── */}
      <section className="max-w-3xl mx-auto px-4 pb-20">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-cyan-50">What Do Credits Get You?</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {creditUsage.map((item) => (
            <div
              key={item.action}
              className="flex items-center justify-between rounded-lg border border-cyan-500/15 bg-black/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4 text-cyan-500/60" />
                <span className="text-sm text-cyan-200/80">{item.action}</span>
              </div>
              <span className="text-sm font-semibold text-cyan-100">
                {item.cost} <span className="text-cyan-500/50 font-normal">credits</span>
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-cyan-500/40 mt-6">
          Cancel anytime · No setup fees · Secure checkout via Stripe
        </p>
      </section>
    </div>
  );
}
