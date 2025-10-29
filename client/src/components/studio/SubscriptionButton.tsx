import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, Loader2, Coins } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export function SubscriptionButton() {
  const [, setLocation] = useLocation();
  
  // Fetch user credits
  const { data: creditData, isLoading } = useQuery({
    queryKey: ['/api/credits'],
    queryFn: () => apiRequest("GET", "/api/credits").then(res => res.json()),
    refetchInterval: 30000, // Check every 30 seconds
  });

  const handleBuyCredits = () => {
    setLocation('/buy-credits');
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled data-testid="button-credits-loading">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  const credits = creditData?.credits || 0;
  const isLowCredits = credits < 5;

  return (
    <div className="flex items-center space-x-2">
      <Badge 
        variant="secondary" 
        className={`${isLowCredits ? 'bg-red-600' : 'bg-gradient-to-r from-amber-600 to-orange-600'} text-white`}
        data-testid="badge-credits"
      >
        <Coins className="h-3 w-3 mr-1" />
        {credits} Credits
      </Badge>
      {isLowCredits && (
        <Button 
          onClick={handleBuyCredits}
          size="sm"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          data-testid="button-buy-credits"
        >
          <Zap className="h-4 w-4 mr-2" />
          Buy Credits
        </Button>
      )}
    </div>
  );
}