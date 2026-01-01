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
                ? 'bg-cyan-600/25 border border-cyan-500/40 text-white' 
                : 'text-cyan-100/70 hover:text-white hover:bg-cyan-500/10 border border-transparent'
            }`}
          >
            <item.icon className="w-4 h-4 text-cyan-300" />
            <span className="hidden md:inline">{item.label}</span>
          </button>
        ))}

        {isAuthenticated && (
          <button
            onClick={() => navigate('/buy-credits')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all text-cyan-100/80 hover:text-white hover:bg-cyan-500/10 border border-transparent"
            title="View credits"
          >
            <Coins className="w-4 h-4 text-cyan-300" />
            <span className="hidden md:inline">
              {currentCredits === null ? 'Credits' : `${currentCredits} Credits`}
            </span>
          </button>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-cyan-100/70 hover:text-white hover:bg-cyan-500/10 border border-transparent"
        >
          <Menu className="w-4 h-4" />
          <span className="hidden md:inline">More</span>
        </button>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full right-0 mt-2 w-56 bg-black/90 border border-cyan-500/40 rounded-xl py-2 z-50 shadow-[0_0_30px_rgba(6,182,212,0.25)] backdrop-blur-md astutely-panel">
              {NAV_ITEMS.slice(6).map(item => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-cyan-100/80 hover:bg-cyan-500/10 hover:text-white transition-all"
                >
                  <item.icon className="w-4 h-4 text-cyan-300" />
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
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-black/80 border border-cyan-500/40 hover:border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.2)] backdrop-blur-md transition-all astutely-panel"
      >
        <div className="w-8 h-8 rounded-lg bg-black/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_18px_rgba(6,182,212,0.25)]">
          <span className="text-cyan-200 font-black text-xs tracking-widest">CS</span>
        </div>
        <span className="text-cyan-100 font-black tracking-widest">{currentPage}</span>
        <ChevronDown className={`w-4 h-4 text-cyan-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isAuthenticated && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/15 hover:text-white"
          onClick={() => navigate('/buy-credits')}
        >
          <Coins className="w-4 h-4 text-cyan-300" />
          {currentCredits === null ? 'Credits' : currentCredits}
        </Button>
      )}

      {isAuthenticated ? (
        <Button
          variant="outline"
          size="sm"
          className="border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/15 hover:text-white"
          onClick={() => navigate('/settings')}
        >
          Account
        </Button>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="gap-1 bg-cyan-600/20 hover:bg-cyan-500/25 border border-cyan-500/40"
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
            className="absolute top-full left-0 mt-2 w-64 bg-black/90 border border-cyan-500/40 rounded-xl py-2 z-50 shadow-[0_0_40px_rgba(6,182,212,0.25)] backdrop-blur-md astutely-panel"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            <div className="px-4 py-2 text-xs font-black uppercase tracking-widest text-cyan-400/80">
              Navigate
            </div>
            
            {NAV_ITEMS.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                  location === item.path
                    ? 'bg-cyan-500/20 text-white'
                    : 'text-cyan-100/80 hover:bg-cyan-500/10 hover:text-white'
                }`}
              >
                <item.icon className={`w-4 h-4 ${location === item.path ? 'text-cyan-300' : 'text-cyan-500/60'}`} />
                <span>{item.label}</span>
                {location === item.path && (
                  <span className="ml-auto text-xs text-cyan-400">●</span>
                )}
              </button>
            ))}
            
            <div className="mx-4 my-2 h-px bg-cyan-500/30" />
            
            <div className="px-4 py-2 text-xs text-cyan-500/60">
              Press <kbd className="px-1.5 py-0.5 bg-cyan-500/10 rounded text-cyan-300">Esc</kbd> to close
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
        className="fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-black/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_24px_rgba(6,182,212,0.25)] hover:scale-110 transition-transform backdrop-blur-md"
        title="Navigation Menu"
      >
        <Menu className="w-6 h-6 text-cyan-200" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-start p-4 bg-black/60 backdrop-blur-sm">
          <div 
            className="w-72 bg-black/90 border border-cyan-500/40 rounded-2xl py-4 shadow-[0_0_40px_rgba(6,182,212,0.25)] backdrop-blur-md astutely-panel"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black/80 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_18px_rgba(6,182,212,0.25)]">
                  <span className="text-cyan-200 font-black tracking-widest">CS</span>
                </div>
                <span className="text-lg font-black text-cyan-100 tracking-widest">
                  CodedSwitch
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-cyan-500/10 transition-all"
              >
                <X className="w-5 h-5 text-cyan-200/80" />
              </button>
            </div>

            <div className="px-4 py-2 text-xs font-black uppercase tracking-widest text-cyan-400/80">
              Navigate To
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-cyan-100/80 hover:bg-cyan-500/10 hover:text-white transition-all"
                >
                  <item.icon className="w-5 h-5 text-cyan-300" />
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
