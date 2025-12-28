// Global Navigation Component - Appears on ALL views
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  Home, LayoutDashboard, Mic2, Shield, MessageSquare, 
  ChevronDown, Menu, LogIn, Coins, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const NAV_ITEMS = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: LayoutDashboard, label: 'Studio', path: '/studio' },
  { icon: Mic2, label: 'Lyrics', path: '/lyric-lab' },
  { icon: Shield, label: 'Security', path: '/vulnerability-scanner' },
  { icon: MessageSquare, label: 'AI Chat', path: '/ai-assistant' },
];

interface GlobalNavProps {
  variant?: 'dropdown' | 'sidebar' | 'topbar';
  className?: string;
}

export function GlobalNav({ variant = 'dropdown', className = '' }: GlobalNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: creditData } = useQuery({
    queryKey: ['/api/credits/balance'],
    queryFn: () => apiRequest('GET', '/api/credits/balance').then((res) => res.json()),
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 15000 : false,
    refetchOnWindowFocus: true,
  });

  const currentCredits = creditData?.balance ?? null;

  const currentPage = NAV_ITEMS.find(item => item.path === location)?.label || 'CodedSwitch';

  if (variant === 'topbar') {
    return (
      <nav className={`flex items-center gap-1 overflow-x-auto ${className}`}>
        {NAV_ITEMS.slice(0, 6).map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
              location === item.path 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <item.icon className="w-4 h-4" />
            <span className="hidden md:inline">{item.label}</span>
          </button>
        ))}

        {isAuthenticated && (
          <button
            onClick={() => navigate('/buy-credits')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all text-gray-300 hover:text-white hover:bg-white/10"
            title="View credits"
          >
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="hidden md:inline">
              {currentCredits === null ? 'Credits' : `${currentCredits} Credits`}
            </span>
          </button>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10"
        >
          <Menu className="w-4 h-4" />
          <span className="hidden md:inline">More</span>
        </button>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full right-0 mt-2 w-56 bg-[#1a1025] border border-purple-500/20 rounded-xl py-2 z-50 shadow-xl">
              {NAV_ITEMS.slice(6).map(item => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-300 hover:bg-white/5 hover:text-white transition-all"
                >
                  <item.icon className="w-4 h-4 text-purple-400" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </nav>
    );
  }

  // Default: Dropdown variant
  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 hover:border-purple-500/50 transition-all"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
          <span className="text-white font-bold text-xs">CS</span>
        </div>
        <span className="text-white font-semibold">{currentPage}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isAuthenticated && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-purple-500/40 text-gray-100 hover:bg-purple-600/30 hover:text-white"
          onClick={() => navigate('/buy-credits')}
        >
          <Coins className="w-4 h-4 text-yellow-400" />
          {currentCredits === null ? 'Credits' : currentCredits}
        </Button>
      )}

      {isAuthenticated ? (
        <Button
          variant="outline"
          size="sm"
          className="border-purple-500/40 text-gray-100 hover:bg-purple-600/30 hover:text-white"
          onClick={() => navigate('/settings')}
        >
          Account
        </Button>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="gap-1 bg-purple-600 hover:bg-purple-700"
          onClick={() => navigate('/login')}
        >
          <LogIn className="w-4 h-4" />
          Sign In
        </Button>
      )}

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute top-full left-0 mt-2 w-64 bg-[#1a1025] border border-purple-500/20 rounded-xl py-2 z-50 shadow-2xl"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-purple-400">
              Navigate
            </div>
            
            {NAV_ITEMS.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                  location === item.path
                    ? 'bg-purple-600/20 text-white'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className={`w-4 h-4 ${location === item.path ? 'text-purple-400' : 'text-gray-500'}`} />
                <span>{item.label}</span>
                {location === item.path && (
                  <span className="ml-auto text-xs text-purple-400">●</span>
                )}
              </button>
            ))}
            
            <div className="mx-4 my-2 h-px bg-purple-500/20" />
            
            <div className="px-4 py-2 text-xs text-gray-500">
              Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-purple-400">Esc</kbd> to close
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Floating nav button for views that don't have space for a full nav
export function FloatingNavButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        title="Navigation Menu"
      >
        <Menu className="w-6 h-6 text-white" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-start p-4 bg-black/60 backdrop-blur-sm">
          <div 
            className="w-72 bg-[#1a1025] border border-purple-500/30 rounded-2xl py-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                  <span className="text-white font-bold">CS</span>
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  CodedSwitch
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-purple-400">
              Navigate To
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-300 hover:bg-white/5 hover:text-white transition-all"
                >
                  <item.icon className="w-5 h-5 text-purple-400" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 h-full" onClick={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
}

export default GlobalNav;
