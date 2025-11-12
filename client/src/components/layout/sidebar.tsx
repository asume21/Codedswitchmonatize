import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Code,
  Music,
  MessageSquare,
  Zap,
  Mic,
  Drum,
  Piano,
  Headphones,
  Upload,
  Shield,
  BarChart3,
  Settings,
  CreditCard,
  Package,
  Layers,
  Sparkles,
  Target,
  FileText,
  Wand2,
  Sliders,
  Keyboard,
  Star,
} from "lucide-react";

const navigation = [
  { name: "🎵 Unified Studio", href: "/unified-studio", icon: Star },
  { name: "🎚️ DAW Layout", href: "/daw-layout", icon: Layers },
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Music Studio", href: "/music-studio", icon: Piano },
  { name: "Mix Studio", href: "/mix-studio", icon: Layers },
  { name: "Pro Console", href: "/pro-console", icon: Sliders },
  { name: "MIDI Controller", href: "/midi-controller", icon: Keyboard },
  { name: "Song Uploader", href: "/song-uploader", icon: Upload },
  { name: "Beat Maker", href: "/beat-studio", icon: Drum },
  { name: "Melody Composer", href: "/melody-composer", icon: Music },
  { name: "Code Translator", href: "/code-translator", icon: Code },
  { name: "Code to Music", href: "/codebeat-studio", icon: Zap },
  { name: "Lyric Lab", href: "/lyric-lab", icon: Mic },
  {
    name: "Vulnerability Scanner",
    href: "/vulnerability-scanner",
    icon: Shield,
  },
  { name: "AI Assistant", href: "/ai-assistant", icon: MessageSquare },
  { name: "Pack Generator", href: "/pack-generator", icon: Package },
  { name: "Advanced Sequencer", href: "/advanced-sequencer", icon: Layers },
  { name: "Granular Engine", href: "/granular-engine", icon: Sparkles },
  { name: "Wavetable Synth", href: "/wavetable-oscillator", icon: Target },
  { name: "Song Structure", href: "/song-structure", icon: FileText },
  { name: "Pro Audio", href: "/pro-audio", icon: Wand2 },
];

const bottomNavigation = [
  { name: "Billing", href: "/billing", icon: CreditCard },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col">
      <div className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-4 w-4 flex-shrink-0",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                />
                {item.name}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="border-t px-3 py-4 space-y-1">
        {bottomNavigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-4 w-4 flex-shrink-0",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                />
                {item.name}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
