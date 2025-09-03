import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Crown, Music } from "lucide-react";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  
  // Extract session ID from URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');

  useEffect(() => {
    // Auto-redirect to studio after 5 seconds
    const timer = setTimeout(() => {
      setLocation('/studio');
    }, 5000);

    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800/50 border-gray-700">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <CardTitle className="text-white text-2xl">Payment Successful!</CardTitle>
          <CardDescription className="text-gray-300">
            Welcome to CodedSwitch Pro! Your subscription is now active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-4 rounded-lg border border-purple-500/30">
            <div className="flex items-center space-x-3 mb-3">
              <Crown className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">Pro Features Unlocked</span>
            </div>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Unlimited music generation</li>
              <li>• Advanced AI composition tools</li>
              <li>• Premium sample libraries</li>
              <li>• Commercial usage rights</li>
            </ul>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-gray-400">
              Session ID: {sessionId || 'N/A'}
            </p>
            <Button 
              onClick={() => setLocation('/studio')}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Music className="mr-2 h-4 w-4" />
              Start Creating Music
            </Button>
            <p className="text-xs text-gray-500">
              Redirecting automatically in 5 seconds...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
