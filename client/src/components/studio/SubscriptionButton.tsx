import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Crown, 
  Check,
  X,
  Sparkles
} from "lucide-react";

interface SubscriptionTier {
  name: string;
  price: string;
  features: string[];
  popular?: boolean;
}

export default function SubscriptionButton() {
  const [showPlans, setShowPlans] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("free");

  const plans: SubscriptionTier[] = [
    {
      name: "Free",
      price: "$0",
      features: [
        "Basic beat making",
        "5 projects",
        "Standard export quality",
        "Community support"
      ]
    },
    {
      name: "Pro",
      price: "$9.99",
      features: [
        "Unlimited projects",
        "AI-powered composition",
        "High-quality exports",
        "Advanced mixing tools",
        "Priority support",
        "Collaboration features"
      ],
      popular: true
    },
    {
      name: "Studio",
      price: "$19.99",
      features: [
        "Everything in Pro",
        "Professional mastering",
        "Custom sample packs",
        "Advanced AI features",
        "White-label exports",
        "API access"
      ]
    }
  ];

  if (!showPlans) {
    return (
      <Button
        variant={currentPlan === "free" ? "default" : "outline"}
        onClick={() => setShowPlans(true)}
        className="relative"
      >
        {currentPlan === "free" ? (
          <>
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Pro
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            {currentPlan === "pro" ? "Pro Plan" : "Studio Plan"}
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Choose Your Plan</h2>
          <Button variant="ghost" onClick={() => setShowPlans(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.name} className={`relative ${plan.popular ? 'border-blue-500 border-2' : ''}`}>
              {plan.popular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold text-blue-600">
                  {plan.price}
                  {plan.price !== "$0" && <span className="text-sm text-gray-500">/month</span>}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className="w-full"
                  variant={currentPlan === plan.name.toLowerCase() ? "outline" : "default"}
                  onClick={() => {
                    setCurrentPlan(plan.name.toLowerCase());
                    setShowPlans(false);
                  }}
                >
                  {currentPlan === plan.name.toLowerCase() ? "Current Plan" : `Choose ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>All plans include a 14-day free trial. Cancel anytime.</p>
        </div>
      </div>
    </div>
  );
}
