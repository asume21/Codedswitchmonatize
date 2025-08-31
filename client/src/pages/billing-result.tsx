import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

export default function BillingResult() {
  const isSuccess = typeof window !== "undefined" && window.location.pathname.endsWith("/success");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-gray-800/50 border-purple-500/20">
          <CardHeader className="text-center space-y-2">
            {isSuccess ? (
              <>
                <CardTitle className="text-white flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-400 mr-2" />
                  Subscription Activated
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Thanks for upgrading! Your subscription will be reflected shortly.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-white flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-400 mr-2" />
                  Checkout Canceled
                </CardTitle>
                <CardDescription className="text-gray-300">
                  No changes were made. You can retry the checkout anytime.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="flex items-center justify-center gap-3 pb-8">
            <Button onClick={() => (window.location.href = "/studio")}>
              Go to Studio
            </Button>
            {!isSuccess && (
              <Button variant="secondary" onClick={() => (window.location.href = "/billing")}>
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
