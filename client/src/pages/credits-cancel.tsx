import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function CreditsCancelPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-slate-800/50 backdrop-blur border-slate-700">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-red-500/20 rounded-full">
              <XCircle className="h-16 w-16 text-red-400" />
            </div>
          </div>
          <CardTitle className="text-3xl text-white">
            Payment Cancelled
          </CardTitle>
          <CardDescription className="text-purple-200 text-lg">
            Your payment was not processed
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="p-6 bg-slate-900/50 rounded-lg">
            <p className="text-purple-200 text-center">
              No charges were made to your account. You can try again or return to the studio.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => setLocation('/buy-credits')}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            
            <Button
              onClick={() => setLocation('/')}
              variant="outline"
              className="w-full border-slate-600 text-white hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Studio
            </Button>
          </div>

          <div className="text-center text-sm text-purple-300">
            <p>Need help? Contact our support team.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
