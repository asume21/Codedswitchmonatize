import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, Settings, LogOut, CreditCard, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function Navigation() {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600"></div>
              <span className="text-xl font-bold">CodedSwitch</span>
            </div>
          </Link>
          <Link href="/piano-roll">
            <span className="px-3 py-1 text-sm rounded bg-purple-700 hover:bg-purple-600 border border-purple-600 cursor-pointer font-semibold" data-testid="link-piano-roll">
              🎹 Piano Roll
            </span>
          </Link>
          <Link href="/snake-io">
            <span className="px-3 py-1 text-sm rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 cursor-pointer">
              Snake IO
            </span>
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{user.username?.substring(0, 2).toUpperCase() || 'CS'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem asChild>
                  <Link href="/billing" className="flex items-center">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button variant="default" size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                Log In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
