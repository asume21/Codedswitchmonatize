import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export function SubscriptionButton() {
  const [, setLocation] = useLocation();
  
  const { data: subscriptionStatus, isLoading } = useQuery({
    queryKey: ['/api/subscription-status'],
    queryFn: () => apiRequest("GET", "/api/subscription-status").then(res => res.json()),
    refetchInterval: 30000, // Check every 30 seconds
  });

  const handleUpgrade = () => {
    setLocation('/subscribe');
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled data-testid="button-subscription-loading">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  if (subscriptionStatus?.hasActiveSubscription) {
    const tierDisplay = subscriptionStatus.tier === 'basic' ? 'Basic' : 'Pro';
    const tierColor = subscriptionStatus.tier === 'basic' 
      ? "bg-gradient-to-r from-blue-600 to-cyan-600" 
      : "bg-gradient-to-r from-purple-600 to-blue-600";
    
    return (
      <div className="flex items-center space-x-2">
        <Badge variant="secondary" className={`${tierColor} text-white`} data-testid="badge-subscription-active">
          <Crown className="h-3 w-3 mr-1" />
          CodedSwitch {tierDisplay}
        </Badge>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleUpgrade}
      size="sm"
      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      data-testid="button-upgrade-pro"
    >
      <Zap className="h-4 w-4 mr-2" />
      Choose Plan
    </Button>
  );
}