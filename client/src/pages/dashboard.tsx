import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Music, Upload, Mic, Shield, MessageSquare, Users, Mic2,
  Zap, Radio, TrendingUp, Clock, Play, CreditCard, Star,
  ChevronRight, Circle, Brain, Code, ShoppingBag, Headphones,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

interface CreditBalance { balance: number; isOwner?: boolean }
interface UserStats { followers: number; following: number; totalSongs: number; credits: number; level: string }
interface Song {
  id: string; name: string; format: string | null; duration: number | null;
  uploadDate: string | null; estimatedBPM: number | null; keySignature: string | null; genre: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Hero card (4 primary features) ────────────────────────────────────────────
function HeroCard({
  href, label, title, desc, icon: Icon, cta, accent,
}: {
  href: string; label: string; title: string; desc: string;
  icon: React.ElementType; cta: string;
  accent: { border: string; bg: string; glow: string; badge: string; badgeText: string; btn: string; icon: string };
}) {
  return (
    <Link href={href}>
      <Card className={`cursor-pointer h-full border ${accent.border} ${accent.bg} ${accent.glow} hover:scale-[1.02] transition-all`}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${accent.icon}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className={`text-xs font-black uppercase tracking-[0.2em] ${accent.badgeText}`}>{label}</div>
              <CardTitle className="text-xl">{title}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{desc}</p>
          <Button className={`w-full ${accent.btn}`}>
            <Zap className="h-4 w-4 mr-2" /> {cta}
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Small tool card (secondary features) ──────────────────────────────────────
function ToolCard({ href, title, desc, icon: Icon, color }: {
  href: string; title: string; desc: string; icon: React.ElementType; color: string;
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer hover:scale-[1.03] transition-all h-full">
        <CardContent className="flex flex-col items-center gap-2 pt-4 pb-4 px-3 text-center">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <p className="text-xs font-semibold leading-tight">{title}</p>
          <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { subscription, isPro } = useAuth();
  const tier = subscription?.tier ?? "free";

  const { data: credits } = useQuery<CreditBalance>({
    queryKey: ["/api/credits/balance"],
    queryFn: () => apiRequest("GET", "/api/credits/balance").then(r => r.json()),
    staleTime: 30_000,
  });
  const { data: stats } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
    queryFn: () => apiRequest("GET", "/api/user/stats").then(r => r.json()),
    staleTime: 60_000,
  });
  const { data: songs } = useQuery<Song[]>({
    queryKey: ["/api/songs"],
    queryFn: () => apiRequest("GET", "/api/songs").then(r => r.json()),
    staleTime: 60_000,
  });

  const creditBalance = credits?.isOwner ? null : (credits?.balance ?? null);
  const creditsLow = creditBalance !== null && !credits?.isOwner && creditBalance < 10;
  const recentSongs = (songs ?? []).slice(0, 5);

  const secondaryTools = [
    { href: "/studio",               title: "Full Studio",       desc: "Beat maker, piano roll, mixer", icon: Music,         color: "bg-violet-600" },
    { href: "/lyric-lab",            title: "Lyric Lab",         desc: "Write & generate lyrics",       icon: Mic2,          color: "bg-orange-500" },
    { href: "/voice-convert",        title: "Voice Convert",     desc: "Transform vocals with AI",      icon: Mic,           color: "bg-blue-500"   },
    { href: "/studio/mix?modal=assistant", title: "AI Assistant",      desc: "Chat about music and code",     icon: MessageSquare, color: "bg-pink-500"   },
    { href: "/vulnerability-scanner",title: "Code Scanner",      desc: "Scan for vulnerabilities",      icon: Shield,        color: "bg-green-500"  },
    { href: "/sample-library",       title: "Sample Library",    desc: "Browse & use samples",          icon: Headphones,    color: "bg-teal-600"   },
    { href: "/pricing",              title: "Upgrade",           desc: "Unlock Pro features",           icon: ShoppingBag,   color: "bg-amber-500"  },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Your creative workspace</p>
        </div>
        <Badge variant={isPro ? "default" : "secondary"} className="text-sm px-3 py-1 gap-1">
          {isPro && <Star className="h-3 w-3" />}
          {tier.toUpperCase()}
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={creditsLow ? "border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.2)]" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credits</CardTitle>
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-2xl font-black">
              {credits?.isOwner ? <span className="text-cyan-400">∞</span>
                : creditBalance !== null ? <span className={creditsLow ? "text-orange-400" : ""}>{creditBalance}</span>
                : <span className="text-muted-foreground">--</span>}
            </div>
            {creditsLow
              ? <Link href="/settings"><p className="text-xs text-orange-400 font-semibold cursor-pointer hover:underline">Low — top up</p></Link>
              : <p className="text-xs text-muted-foreground">{credits?.isOwner ? "Unlimited" : "Available"}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Songs</CardTitle>
            <Music className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-2xl font-black">{stats?.totalSongs ?? "--"}</div>
            <p className="text-xs text-muted-foreground">Uploaded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Followers</CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-2xl font-black">{stats?.followers ?? "--"}</div>
            <p className="text-xs text-muted-foreground">{stats ? `Following ${stats.following}` : "Social"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Level</CardTitle>
            <Star className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-2xl font-black">{stats?.level ?? "--"}</div>
            <p className="text-xs text-muted-foreground">Creator rank</p>
          </CardContent>
        </Card>
      </div>

      {/* ── PRIMARY 4 HERO CARDS ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">Start Creating</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <HeroCard
            href="/organism"
            label="WOW Mode"
            title="Organism AI"
            desc="Speak a rhythm — the AI generates drums, bass, chords, and melody in real time."
            icon={Radio}
            cta="Launch Organism"
            accent={{
              border: "border-cyan-500/40",
              bg: "bg-gradient-to-br from-cyan-950/40 to-black",
              glow: "shadow-[0_0_28px_rgba(6,182,212,0.18)] hover:shadow-[0_0_40px_rgba(6,182,212,0.3)]",
              badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]",
              badgeText: "text-cyan-400",
              btn: "bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30",
              icon: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
            }}
          />
          <HeroCard
            href="/recording-booth"
            label="Record + AI"
            title="Recording Booth"
            desc="Organism generates a live beat while you record your vocals over it. One take, full track."
            icon={Circle}
            cta="Enter Booth"
            accent={{
              border: "border-red-500/40",
              bg: "bg-gradient-to-br from-red-950/40 to-black",
              glow: "shadow-[0_0_28px_rgba(239,68,68,0.15)] hover:shadow-[0_0_40px_rgba(239,68,68,0.28)]",
              badge: "",
              badgeText: "text-red-400",
              btn: "bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30",
              icon: "border-red-400/40 bg-red-400/10 text-red-300",
            }}
          />
          <HeroCard
            href="/studio/mix?modal=assistant"
            label="AI Brain"
            title="Astutely"
            desc="Your creative director. Ask anything — beat ideas, song structures, lyric rewrites, music theory."
            icon={Brain}
            cta="Talk to Astutely"
            accent={{
              border: "border-violet-500/40",
              bg: "bg-gradient-to-br from-violet-950/40 to-black",
              glow: "shadow-[0_0_28px_rgba(139,92,246,0.15)] hover:shadow-[0_0_40px_rgba(139,92,246,0.28)]",
              badge: "",
              badgeText: "text-violet-400",
              btn: "bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30",
              icon: "border-violet-400/40 bg-violet-400/10 text-violet-300",
            }}
          />
          <HeroCard
            href="/social-hub"
            label="Community"
            title="Social Hub"
            desc="Drop your tracks, follow producers, get feedback, and discover what's hitting right now."
            icon={Users}
            cta="Open Social Hub"
            accent={{
              border: "border-emerald-500/40",
              bg: "bg-gradient-to-br from-emerald-950/40 to-black",
              glow: "shadow-[0_0_28px_rgba(16,185,129,0.15)] hover:shadow-[0_0_40px_rgba(16,185,129,0.28)]",
              badge: "",
              badgeText: "text-emerald-400",
              btn: "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30",
              icon: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
            }}
          />
        </div>
      </div>

      {/* ── RECENT SONGS ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Your Songs</CardTitle>
          <Link href="/social-hub">
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground">
              View All <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentSongs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
              <Upload className="h-8 w-8 opacity-30" />
              <p className="text-sm">No songs yet — upload one or generate in the Studio.</p>
              <Link href="/studio">
                <Button variant="outline" size="sm">Go to Studio</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSongs.map((song) => (
                <div key={song.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.05] transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/15 border border-violet-500/20">
                    <Music className="h-3.5 w-3.5 text-violet-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{song.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[song.genre, song.keySignature, song.estimatedBPM ? `${song.estimatedBPM} BPM` : null]
                        .filter(Boolean).join(" · ") || (song.format ?? "audio")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span>{formatDuration(song.duration)}</span>
                    <span className="hidden sm:inline flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {timeAgo(song.uploadDate)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── SECONDARY TOOLS ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">More Tools</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {secondaryTools.map((t) => (
            <ToolCard key={t.href} {...t} />
          ))}
        </div>
      </div>

      {/* Upgrade CTA */}
      {!isPro && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-950/30 to-black">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-bold">Upgrade to Pro</p>
                <p className="text-xs text-muted-foreground">Unlock unlimited generation, premium AI models, and more credits.</p>
              </div>
            </div>
            <Link href="/settings">
              <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400 shrink-0 font-bold">Upgrade</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
