import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Music, Loader2 } from "lucide-react";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    activationKey: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      // If activation key provided, activate the account
      if (formData.activationKey.trim()) {
        try {
          const activationResponse = await fetch("/api/keys/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activationKey: formData.activationKey.trim() }),
            credentials: "include",
          });

          if (activationResponse.ok) {
            toast({
              title: "Account created with Pro access!",
              description: "Welcome to CodedSwitch Pro. You're now logged in.",
            });
          } else {
            toast({
              title: "Account created (Free tier)",
              description: "Invalid activation key - you're on the free tier. You can upgrade later.",
              variant: "default",
            });
          }
        } catch (activationError) {
          // Account created but activation failed - not critical
          toast({
            title: "Account created (Free tier)",
            description: "Activation key invalid - you can upgrade later in settings.",
          });
        }
      } else {
        toast({
          title: "Account created!",
          description: "Welcome to CodedSwitch Free. Upgrade anytime with an activation key.",
        });
      }

      // Redirect to home
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <Card className="w-full max-w-md bg-gray-900 border-gray-700">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
              <Music className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Create Account</CardTitle>
          <CardDescription className="text-gray-400">
            Join CodedSwitch and start creating music
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-200">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="musicmaker"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                disabled={isLoading}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <p className="text-xs text-gray-500">Optional - we'll use your email if blank</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-200">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <p className="text-xs text-gray-500">At least 8 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-200">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={isLoading}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            
            <div className="border-t border-gray-700 pt-4">
              <div className="space-y-2">
                <Label htmlFor="activationKey" className="text-gray-200">
                  Activation Key <span className="text-gray-500">(Optional)</span>
                </Label>
                <Input
                  id="activationKey"
                  type="text"
                  placeholder="CS-XXXX-XXXX-XXXX-XXXX"
                  value={formData.activationKey}
                  onChange={(e) => setFormData({ ...formData, activationKey: e.target.value.toUpperCase() })}
                  disabled={isLoading}
                  className="bg-gray-800 border-gray-700 text-white font-mono"
                />
                <p className="text-xs text-gray-500">
                  Have a Pro activation key? Enter it now or upgrade later
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
            <div className="text-center text-sm text-gray-400">
              Already have an account?{" "}
              <a href="/login" className="text-blue-400 hover:text-blue-300 underline">
                Sign in
              </a>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
