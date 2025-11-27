import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Zap, Crown, Building2, Check, Loader2, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface CreditPackage {
  key: string;
  name: string;
  credits: number;
  price: number;
  description: string;
  badge?: string;
  popular?: boolean;
}

interface MembershipTier {
  key: string;
  name: string;
  price: number;
  monthlyCredits: number;
  rolloverMax: number;
  features: string[];
  badge?: string;
  popular?: boolean;
}

const creditPackages: CreditPackage[] = [
  {
    key: 'STARTER',
    name: 'Starter Pack',
    credits: 100,
    price: 4.99,
    description: 'Perfect for trying out features',
  },
  {
    key: 'POPULAR',
    name: 'Popular Pack',
    credits: 500,
    price: 19.99,
    description: 'Save 20% - Best for regular users',
    badge: 'Popular',
    popular: true,
  },
  {
    key: 'PRO',
    name: 'Pro Pack',
    credits: 1000,
    price: 34.99,
    description: 'Save 30% - For power users',
    badge: 'Best Value',
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise Pack',
    credits: 5000,
    price: 149.99,
    description: 'Save 40% - Maximum value',
  },
];

const membershipTiers: MembershipTier[] = [
  {
    key: 'CREATOR',
    name: 'Creator',
    price: 9.99,
    monthlyCredits: 200,
    rolloverMax: 400,
    features: [
      '200 credits per month',
      'Credits rollover (max 400)',
      'Priority support',
      'No ads',
      'Early access to features',
      'Premium templates',
    ],
    badge: 'Most Popular',
    popular: true,
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: 29.99,
    monthlyCredits: 750,
    rolloverMax: 1500,
    features: [
      '750 credits per month',
      'Credits rollover (max 1500)',
      'Priority queue',
      'Advanced analytics',
      'Commercial license',
      'API access',
      'Advanced AI models',
    ],
    badge: 'Best Value',
  },
  {
    key: 'STUDIO',
    name: 'Studio',
    price: 79.99,
    monthlyCredits: 2500,
    rolloverMax: 5000,
    features: [
      '2500 credits per month',
      'Credits rollover (max 5000)',
      'Team collaboration (5 seats)',
      'White-label branding',
      'Dedicated support',
      'Custom integrations',
      'Phone support',
      'Training sessions',
    ],
    badge: 'Enterprise',
  },
];

export default function BuyCreditsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);

  // Fetch current credit balance
  const { data: creditData } = useQuery({
    queryKey: ['/api/credits/balance'],
    queryFn: () => apiRequest("GET", "/api/credits/balance").then(res => res.json()),
  });

  // Purchase credits mutation
  const purchaseMutation = useMutation({
    mutationFn: async (packageKey: string) => {
      const response = await apiRequest("POST", "/api/credits/purchase-checkout", {
        packageKey,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
      setPurchasingPackage(null);
    },
  });

  const handlePurchase = (packageKey: string) => {
    setPurchasingPackage(packageKey);
    purchaseMutation.mutate(packageKey);
  };

  const currentCredits = creditData?.balance || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="text-white hover:text-purple-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Studio
          </Button>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              Get More Credits
            </h1>
            <p className="text-purple-200 text-lg">
              Choose the perfect plan for your creative needs
            </p>
            <div className="mt-4">
              <Badge
                variant="secondary"
                className="bg-purple-600 text-white text-lg px-4 py-2"
                data-testid="credits-balance"
              >
                <Coins className="h-5 w-5 mr-2" />
                Current Balance: {currentCredits} Credits
              </Badge>
            </div>
          </div>
        </div>

        {/* Tabs for One-Time vs Subscription */}
        <Tabs defaultValue="one-time" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="one-time">One-Time Purchase</TabsTrigger>
            <TabsTrigger value="subscription">Monthly Membership</TabsTrigger>
          </TabsList>

          {/* One-Time Credit Packs */}
          <TabsContent value="one-time">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {creditPackages.map((pkg) => (
                <Card
                  key={pkg.key}
                  data-testid="credit-package"
                  className={`relative ${
                    pkg.popular
                      ? 'border-purple-500 border-2 shadow-lg shadow-purple-500/50'
                      : 'border-slate-700'
                  } bg-slate-800/50 backdrop-blur`}
                >
                  {pkg.badge && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        {pkg.badge}
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                      <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full">
                        <Coins className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <CardTitle className="text-center text-white text-2xl">
                      {pkg.name}
                    </CardTitle>
                    <CardDescription className="text-center text-purple-200">
                      {pkg.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="text-center">
                    <div className="mb-4">
                      <div className="text-4xl font-bold text-white mb-2">
                        {pkg.credits}
                      </div>
                      <div className="text-purple-300">Credits</div>
                    </div>
                    <div className="text-3xl font-bold text-white">
                      ${pkg.price}
                    </div>
                    <div className="text-sm text-purple-300 mt-1">
                      ${(pkg.price / pkg.credits).toFixed(3)} per credit
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      onClick={() => handlePurchase(pkg.key)}
                      disabled={purchasingPackage === pkg.key}
                      className={`w-full ${
                        pkg.popular
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {purchasingPackage === pkg.key ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Buy Now
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Monthly Memberships */}
          <TabsContent value="subscription">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {membershipTiers.map((tier) => (
                <Card
                  key={tier.key}
                  className={`relative ${
                    tier.popular
                      ? 'border-purple-500 border-2 shadow-lg shadow-purple-500/50 scale-105'
                      : 'border-slate-700'
                  } bg-slate-800/50 backdrop-blur`}
                >
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        {tier.badge}
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                      <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full">
                        {tier.key === 'CREATOR' && <Zap className="h-8 w-8 text-white" />}
                        {tier.key === 'PRO' && <Crown className="h-8 w-8 text-white" />}
                        {tier.key === 'STUDIO' && <Building2 className="h-8 w-8 text-white" />}
                      </div>
                    </div>
                    <CardTitle className="text-center text-white text-2xl">
                      {tier.name}
                    </CardTitle>
                    <div className="text-center mt-4">
                      <div className="text-4xl font-bold text-white">
                        ${tier.price}
                      </div>
                      <div className="text-purple-300">per month</div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="mb-6 p-4 bg-purple-900/30 rounded-lg text-center">
                      <div className="text-2xl font-bold text-white">
                        {tier.monthlyCredits} Credits
                      </div>
                      <div className="text-sm text-purple-300">
                        Rollover up to {tier.rolloverMax}
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start text-purple-200">
                          <Check className="h-5 w-5 mr-2 text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      onClick={() => handlePurchase(tier.key)}
                      disabled={purchasingPackage === tier.key}
                      className={`w-full ${
                        tier.popular
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {purchasingPackage === tier.key ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Crown className="h-4 w-4 mr-2" />
                          Subscribe Now
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Credit Usage Info */}
        <div className="mt-12 max-w-4xl mx-auto">
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">How Credits Work</CardTitle>
            </CardHeader>
            <CardContent className="text-purple-200 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-white mb-2">Music Generation:</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Full Song: 25 credits</li>
                    <li>• Beat Generation: 5 credits</li>
                    <li>• Melody: 5 credits</li>
                    <li>• Instrumental: 8 credits</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Lyrics & Analysis:</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Lyrics Generation: 4 credits</li>
                    <li>• Lyrics Analysis: 2 credits</li>
                    <li>• Rhyme Suggestions: 1 credit</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
