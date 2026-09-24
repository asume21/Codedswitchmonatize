import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Crown, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function BillingSuccessPage() {
  const [, setLocation] = useLocation();

  // Refetch subscription status (webhook provisions it server-side)
  const { data: subData, refetch } = useQuery({
    queryKey: ['/api/subscription-status'],
    queryFn: () => apiRequest("GET", "/api/subscription-status").then(res => res.json()),
  });

  useEffect(() => {
    // Refetch after a short delay to ensure webhook has processed
    const timer = setTimeout(() => {
      refetch();
    }, 2000);
    return () => clearTimeout(timer);
  }, [refetch]);

  const tier = subData?.tier || 'pro';
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-slate-800/50 backdrop-blur border-slate-700">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-green-500/20 rounded-full">
              <CheckCircle className="h-16 w-16 text-green-400" />
            </div>
          </div>
          <CardTitle className="text-3xl text-white">
            Subscription Active!
          </CardTitle>
          <CardDescription className="text-purple-200 text-lg">
            Welcome to {tierLabel} — your plan is ready to use
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="p-6 bg-purple-900/30 rounded-lg text-center">
            <div className="text-sm text-purple-300 mb-2">Your Plan</div>
            <div className="flex items-center justify-center text-4xl font-bold text-white">
              <Crown className="h-8 w-8 mr-3 text-yellow-400" />
              {tierLabel}
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => setLocation('/')}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              Start Creating
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <Button
              onClick={() => setLocation('/pricing')}
              variant="outline"
              className="w-full border-slate-600 text-white hover:bg-slate-700"
            >
              View Plans
            </Button>
          </div>

          <div className="text-center text-sm text-purple-300">
            <p>Thank you for subscribing!</p>
            <p className="mt-1">A receipt has been sent to your email.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
