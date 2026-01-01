import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { 
  Settings, CreditCard, LogIn, ChevronDown,
  Coins, Home, LayoutDashboard, Mic2, Shield, MessageSquare
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const NAV_ITEMS = [
  { icon: Home, label: 'Home', path: '/', color: 'bg-cyan-600/25 border border-cyan-500/40' },
  { icon: LayoutDashboard, label: 'Studio', path: '/studio', color: 'bg-cyan-600/25 border border-cyan-500/40' },
  { icon: Mic2, label: 'Lyrics', path: '/lyric-lab', color: 'bg-cyan-600/25 border border-cyan-500/40' },
  { icon: Shield, label: 'Security', path: '/vulnerability-scanner', color: 'bg-cyan-600/25 border border-cyan-500/40' },
  { icon: MessageSquare, label: 'AI Chat', path: '/ai-assistant', color: 'bg-cyan-600/25 border border-cyan-500/40' },
];

export function Navigation() {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const [moreOpen, setMoreOpen] = useState(false);
  const [location] = useLocation();

  // Show all items in nav bar (simplified navigation)
  const visibleItems = NAV_ITEMS.slice(0, 3);
  const moreItems = NAV_ITEMS.slice(3);

  return (
    <nav className="astutely-panel border-b border-cyan-500/40 bg-black/80 backdrop-blur-md" role="navigation" aria-label="Main navigation">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left: Logo + Nav Items */}
        <div className="flex items-center space-x-2">
          <Link href="/">
            <div className="flex items-center space-x-2 mr-4">
              <div className="h-8 w-8 rounded-lg bg-black/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_18px_rgba(6,182,212,0.25)]">
                <span className="text-cyan-200 font-black text-xs tracking-widest">CS</span>
              </div>
              <span className="text-lg font-black hidden sm:block text-cyan-100 tracking-widest">CodedSwitch</span>
            </div>
          </Link>
          
          {/* Main Nav Items */}
          {visibleItems.map(item => (
            <Link key={item.path} href={item.path}>
              <span 
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg cursor-pointer font-medium transition-all ${
                  location === item.path 
                    ? `${item.color} text-white` 
                    : 'text-cyan-100/70 hover:text-white hover:bg-cyan-500/10 border border-transparent'
                }`}
              >
                <item.icon className="w-4 h-4 text-cyan-300" />
                <span className="hidden md:inline">{item.label}</span>
              </span>
            </Link>
          ))}
          
          {/* More Dropdown */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-cyan-100/70 hover:text-white hover:bg-cyan-500/10 transition-all border border-transparent"
              aria-expanded={moreOpen}
              aria-haspopup="true"
              aria-label="More navigation options"
            >
              <span className="hidden md:inline">More</span>
              <ChevronDown className={`w-4 h-4 text-cyan-300 transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div className="absolute top-full left-0 mt-2 w-56 bg-black/90 border border-cyan-500/40 rounded-xl py-2 z-50 shadow-[0_0_30px_rgba(6,182,212,0.25)] backdrop-blur-md astutely-panel">
                  {moreItems.map(item => (
                    <Link key={item.path} href={item.path}>
                      <span
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-all ${
                          location === item.path
                            ? 'bg-cyan-500/20 text-white'
                            : 'text-cyan-100/80 hover:bg-cyan-500/10 hover:text-white'
                        }`}
                      >
                        <item.icon className="w-4 h-4 text-cyan-300" />
                        {item.label}
                      </span>
                    </Link>
                  ))}

                  <div className="mx-4 my-2 h-px bg-cyan-500/30" />

                  <Link href="/buy-credits">
                    <span
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-all text-cyan-100/80 hover:bg-cyan-500/10 hover:text-white"
                    >
                      <Coins className="w-4 h-4 text-cyan-300" />
                      Get Credits
                    </span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: User Menu */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <Link href="/buy-credits">
            <Button variant="secondary" size="sm" className="gap-2">
              <Coins className="h-4 w-4" />
              <span className="hidden sm:inline">Get Credits</span>
            </Button>
          </Link>
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full" aria-label="User menu">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>CS</AvatarFallback>
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
