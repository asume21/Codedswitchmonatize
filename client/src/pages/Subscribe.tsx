// Simple Stripe Checkout redirect flow
import { useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Music, Code, Zap, Shield, Star, Crown } from "lucide-react";

interface SubscribeFormProps {
  selectedTier: 'basic' | 'pro';
}

const SubscribeForm = ({ selectedTier }: SubscribeFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    
    try {
      // Create checkout session and redirect to Stripe
      const response = await apiRequest("POST", "/api/create-checkout-session", { 
        tier: selectedTier 
      });
      
      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Checkout creation failed:", error);
      toast({
        title: "Payment Setup Failed",
        description: "Unable to create checkout session. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button 
        onClick={handleSubscribe}
        disabled={isLoading} 
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        data-testid="button-subscribe"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Redirecting to Payment...
          </>
        ) : (
          <>
            <Crown className="mr-2 h-4 w-4" />
            Subscribe to CodedSwitch {selectedTier === 'basic' ? 'Basic' : 'Pro'}
          </>
        )}
      </Button>
      <p className="text-xs text-gray-400 text-center">
        You'll be redirected to Stripe's secure payment page
      </p>
    </div>
  );
};

export default function Subscribe() {
  const [selectedTier, setSelectedTier] = useState<'basic' | 'pro'>('pro');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Upgrade to <span className="text-purple-400">CodedSwitch Pro</span>
          </h1>
          <p className="text-gray-300 text-lg">
            Unlock the world's first bidirectional code-music translation platform
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Features */}
          <Card className="bg-gray-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Star className="mr-2 h-5 w-5 text-yellow-400" />
                What's Included
              </CardTitle>
              <CardDescription className="text-gray-300">
                Everything you need to bridge code and music
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <Music className="h-5 w-5 text-purple-400 mt-0.5" />
                <div>
                  <h4 className="text-white font-medium">Tiered Upload Limits</h4>
                  <p className="text-gray-400 text-sm">Basic: 100 songs/month • Pro: Unlimited uploads with advanced AI analysis and collaboration detection</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Code className="h-5 w-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="text-white font-medium">Bidirectional Translation</h4>
                  <p className="text-gray-400 text-sm">Convert code to music AND music back to functional code - the world's first bidirectional translation</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Zap className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="text-white font-medium">AI Memory Assistant</h4>
                  <p className="text-gray-400 text-sm">Conversational AI that remembers your projects and provides contextual recommendations</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-green-400 mt-0.5" />
                <div>
                  <h4 className="text-white font-medium">Commercial Features</h4>
                  <p className="text-gray-400 text-sm">Basic: Personal use • Pro: Commercial licensing, export rights, and professional vulnerability scanning</p>
                </div>
              </div>
              <div className="bg-purple-900/30 p-3 rounded-lg">
                <p className="text-purple-200 font-medium text-center">
                  Choose your tier: Basic for enhanced features or Pro for unlimited commercial use
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card className="bg-gray-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white text-center">
                <Crown className="inline mr-2 h-5 w-5 text-yellow-400" />
                Subscribe Now
              </CardTitle>
              <CardDescription className="text-center space-y-4">
                {/* Basic Tier */}
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedTier === 'basic' 
                      ? 'border-blue-500 bg-blue-900/30' 
                      : 'border-blue-500/30 bg-blue-900/20 hover:bg-blue-900/25'
                  }`}
                  onClick={() => setSelectedTier('basic')}
                  data-testid="tier-basic"
                >
                  <div className="text-lg font-semibold text-blue-400">Basic</div>
                  <div>
                    <span className="text-2xl font-bold text-white">$10</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                  <div className="text-sm text-gray-300">Enhanced features + 100 uploads/month</div>
                  {selectedTier === 'basic' && (
                    <div className="mt-2 text-xs text-blue-300 font-medium">✓ Selected</div>
                  )}
                </div>
                
                {/* Pro Tier - Featured */}
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-all relative ${
                    selectedTier === 'pro' 
                      ? 'border-purple-500 bg-gradient-to-r from-purple-900/40 to-blue-900/40' 
                      : 'border-purple-500/50 bg-gradient-to-r from-purple-900/30 to-blue-900/30 hover:from-purple-900/35 hover:to-blue-900/35'
                  }`}
                  onClick={() => setSelectedTier('pro')}
                  data-testid="tier-pro"
                >
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold">MOST POPULAR</span>
                  </div>
                  <div className="text-lg font-semibold text-purple-400">Pro</div>
                  <div>
                    <span className="text-3xl font-bold text-white">$39.99</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                  <div className="text-sm text-gray-300">Unlimited everything + commercial license</div>
                  {selectedTier === 'pro' && (
                    <div className="mt-2 text-xs text-purple-300 font-medium">✓ Selected</div>
                  )}
                </div>
                
                <div className="text-sm text-green-400">Cancel anytime • No setup fees</div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubscribeForm selectedTier={selectedTier} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};