import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Key, Check } from "lucide-react";

export default function ActivatePage() {
  const [activationKey, setActivationKey] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activationKey.trim()) {
      toast({
        title: "Activation Key Required",
        description: "Please enter your activation key",
        variant: "destructive",
      });
      return;
    }

    setIsActivating(true);

    try {
      const response = await fetch("/api/keys/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activationKey: activationKey.trim() }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Activation failed");
      }

      toast({
        title: data.isOwner ? "Owner Access Activated!" : "Activation Successful!",
        description: data.message,
        duration: 5000,
      });

      // Redirect to dashboard after successful activation
      setTimeout(() => setLocation("/"), 1000);

    } catch (error: any) {
      toast({
        title: "Activation Failed",
        description: error.message || "Invalid activation key. Please try again.",
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-gray-900 to-black p-4">
      <Card className="w-full max-w-md border-purple-500/20 bg-gray-900/50 backdrop-blur">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Key className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Activate CodedSwitch</CardTitle>
          <CardDescription className="text-center">
            Enter your activation key to unlock full access
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleActivate}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="activation-key" className="text-sm font-medium text-gray-300">
                Activation Key
              </label>
              <Input
                id="activation-key"
                type="text"
                placeholder="PRO-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value.toUpperCase())}
                className="font-mono text-center tracking-wider"
                disabled={isActivating}
              />
              <p className="text-xs text-gray-400">
                Keys start with your tier (e.g., PRO/BASIC/TRIAL). Check your email after payment.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-start gap-2 text-xs text-gray-400">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>Unlimited AI generations</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-400">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>Advanced studio features</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-400">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>Song analysis & insights</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={isActivating}
            >
              {isActivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </Button>
            
            <p className="text-xs text-center text-gray-400">
              Don't have a key?{" "}
              <a href="/pricing" className="text-purple-400 hover:text-purple-300">
                Get access
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
