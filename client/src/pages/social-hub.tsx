import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import {
  Share2, Twitter, Facebook, Instagram, Youtube, Users, Heart,
  MessageCircle, TrendingUp, Send, Search, UserPlus, UserMinus,
  Wifi, WifiOff, BookOpen, BarChart3, Handshake, Globe, RefreshCw,
  Clock, Eye, ThumbsUp, PenLine, Calendar, Music, Code, Zap,
} from 'lucide-react';

type TabId = 'feed' | 'connections' | 'chat' | 'collabs' | 'blog' | 'discover' | 'analytics';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'feed', label: 'Feed', icon: <Globe className="h-4 w-4" /> },
  { id: 'connections', label: 'Connections', icon: <Wifi className="h-4 w-4" /> },
  { id: 'chat', label: 'Chat', icon: <MessageCircle className="h-4 w-4" /> },
  { id: 'collabs', label: 'Collabs', icon: <Handshake className="h-4 w-4" /> },
  { id: 'blog', label: 'Blog', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'discover', label: 'Discover', icon: <Search className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
];

const PLATFORMS = [
  { id: 'twitter', name: 'Twitter/X', icon: <Twitter className="h-5 w-5" />, description: 'Share your beats on Twitter', color: 'cyan' },
  { id: 'instagram', name: 'Instagram', icon: <Instagram className="h-5 w-5" />, description: 'Post your music to Instagram', color: 'pink' },
  { id: 'youtube', name: 'YouTube', icon: <Youtube className="h-5 w-5" />, description: 'Upload music videos', color: 'red' },
  { id: 'facebook', name: 'Facebook', icon: <Facebook className="h-5 w-5" />, description: 'Share with your network', color: 'blue' },
];

/* ═══════════════════════════════════════
   ORGANISM SESSION CARD
   ═══════════════════════════════════════ */
function OrganismSessionCard({ post, isAuthenticated }: { post: any; isAuthenticated: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Parse metadata from content
  let caption = '';
  let bpm = 0;
  let key = '';
  try {
    const parsed = JSON.parse(post.content || '{}');
    caption = parsed.caption || '';
    bpm = parsed.bpm || 0;
    key = parsed.key || '';
  } catch {
    caption = post.content || '';
  }

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="rounded-xl border border-cyan-500/15 bg-black/40 p-4 hover:border-cyan-500/30 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-purple-700 text-white text-xs font-bold">
            {(post.displayName || 'A').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-cyan-100 font-bold text-sm">{post.displayName || 'Anonymous'}</span>
            <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[10px] px-1.5 py-0">Organism</Badge>
            <span className="text-cyan-500/30 text-xs ml-auto">{formatTimeAgo(post.createdAt)}</span>
          </div>
          {caption && <p className="text-cyan-200/70 text-xs mt-0.5 truncate">{caption}</p>}
        </div>
      </div>

      {/* DNA pills */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {bpm > 0 && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            {Math.round(bpm)} BPM
          </span>
        )}
        {key && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
            {key}
          </span>
        )}
      </div>

      {/* Audio player */}
      {post.mediaUrl ? (
        <div className="flex items-center gap-3 mb-3 bg-black/30 rounded-lg p-2.5">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-cyan-600 hover:bg-cyan-500 flex items-center justify-center text-white shrink-0 transition-colors"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <audio
            ref={audioRef}
            src={post.mediaUrl}
            onEnded={() => setIsPlaying(false)}
            className="flex-1 h-6"
            controls
            style={{ height: 24, opacity: 0.7 }}
          />
        </div>
      ) : (
        <div className="mb-3 bg-black/20 rounded-lg p-2.5 text-center text-xs text-cyan-500/40">
          No audio recorded
        </div>
      )}

      {/* Actions + CTA */}
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <button className="flex items-center gap-1 text-cyan-500/40 hover:text-pink-400 text-xs transition-colors">
              <Heart className="h-3.5 w-3.5" /> {post.likes || 0}
            </button>
            <button className="flex items-center gap-1 text-cyan-500/40 hover:text-cyan-300 text-xs transition-colors">
              <MessageCircle className="h-3.5 w-3.5" /> {post.comments || 0}
            </button>
          </>
        ) : (
          <span className="text-cyan-500/30 text-xs">{post.likes || 0} likes</span>
        )}
        <Link href="/organism" className="ml-auto">
          <Button size="sm" className="h-7 text-[11px] px-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold border-0">
            Try Organism →
          </Button>
        </Link>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'just now';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ═══════════════════════════════════════
   FEED TAB
   ═══════════════════════════════════════ */
function FeedTab({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState('status');

  const { data: feedData, isLoading } = useQuery({
    queryKey: ['/api/social/posts'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/posts'); return await res.json(); }
      catch { return { posts: [], stats: null }; }
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (data: { platform: string; content: string; type: string; title: string; url: string }) => {
      const res = await apiRequest('POST', '/api/social/share', data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/social/posts'] }); setPostContent(''); toast({ title: 'Posted!', description: 'Your post is live.' }); },
    onError: () => { toast({ title: 'Post Failed', variant: 'destructive' }); },
  });

  const handlePost = () => {
    if (!postContent.trim()) return;
    shareMutation.mutate({ platform: 'codedswitch', content: postContent, type: postType, title: '', url: window.location.origin });
  };

  const posts = feedData?.posts || [];
  const stats = feedData?.stats || { totalShares: 0, totalViews: 0, totalLikes: 0, totalComments: 0 };

  return (
    <div className="space-y-4">
      {/* Compose */}
      <div className="rounded-xl border border-cyan-500/20 bg-black/40 p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-sm font-bold">CS</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              id="social-post-content"
              name="social-post-content"
              autoComplete="off"
              placeholder="Share what you're working on..."
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="bg-black/30 border-cyan-500/20 text-cyan-100 placeholder:text-cyan-500/40 min-h-[80px] resize-none"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {[
                  { type: 'status', icon: <PenLine className="h-3 w-3" />, label: 'Status' },
                  { type: 'beat', icon: <Music className="h-3 w-3" />, label: 'Beat' },
                  { type: 'project', icon: <Code className="h-3 w-3" />, label: 'Project' },
                ].map(t => (
                  <button
                    key={t.type}
                    onClick={() => setPostType(t.type)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${postType === t.type ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-cyan-500/50 hover:text-cyan-400'}`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                onClick={handlePost}
                disabled={!postContent.trim() || shareMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs tracking-wider"
              >
                <Send className="h-3 w-3 mr-1" />
                {shareMutation.isPending ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Posts', value: stats.totalShares, icon: <Share2 className="h-4 w-4" />, color: 'cyan' },
          { label: 'Views', value: stats.totalViews, icon: <Eye className="h-4 w-4" />, color: 'blue' },
          { label: 'Likes', value: stats.totalLikes, icon: <ThumbsUp className="h-4 w-4" />, color: 'purple' },
          { label: 'Comments', value: stats.totalComments, icon: <MessageCircle className="h-4 w-4" />, color: 'pink' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-cyan-500/10 bg-black/30 p-3 text-center">
            <div className={`text-${s.color}-400 flex justify-center mb-1`}>{s.icon}</div>
            <div className="text-lg font-black text-white">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-cyan-500/50">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Posts Feed */}
      {isLoading ? (
        <div className="text-center py-12 text-cyan-500/50">Loading feed...</div>
      ) : posts.length > 0 ? (
        <div className="space-y-3">
          {posts.map((post: any) => (
            post.type === 'organism-session' ? (
              <OrganismSessionCard key={post.id} post={post} isAuthenticated={isAuthenticated} />
            ) : (
            <div key={post.id} className="rounded-xl border border-cyan-500/10 bg-black/30 p-4 hover:border-cyan-500/25 transition-colors">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-purple-700 text-white text-xs font-bold">
                    {(post.displayName || 'A').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-cyan-100 font-bold text-sm">{post.displayName || 'Anonymous'}</span>
                    <Badge className="bg-cyan-500/10 text-cyan-400/70 border-cyan-500/20 text-[10px] px-1.5 py-0">{post.type || 'share'}</Badge>
                    <span className="text-cyan-500/30 text-xs ml-auto">{formatTimeAgo(post.createdAt)}</span>
                  </div>
                  <p className="text-cyan-200/80 text-sm leading-relaxed">{post.content}</p>
                  <div className="flex items-center gap-4 mt-3">
                    {isAuthenticated && (
                      <>
                        <button className="flex items-center gap-1 text-cyan-500/40 hover:text-pink-400 text-xs transition-colors">
                          <Heart className="h-3.5 w-3.5" /> {post.likes || 0}
                        </button>
                        <button className="flex items-center gap-1 text-cyan-500/40 hover:text-cyan-300 text-xs transition-colors">
                          <MessageCircle className="h-3.5 w-3.5" /> {post.comments || 0}
                        </button>
                        <button className="flex items-center gap-1 text-cyan-500/40 hover:text-green-400 text-xs transition-colors">
                          <Share2 className="h-3.5 w-3.5" /> {post.shares || 0}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-cyan-500/10 bg-black/30 p-12 text-center">
          <Share2 className="h-10 w-10 text-cyan-500/20 mx-auto mb-3" />
          <h3 className="text-cyan-100 font-bold mb-1">No Activity Yet</h3>
          <p className="text-cyan-500/40 text-sm">Share your first creation or follow other producers to see their posts!</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   CONNECTIONS TAB
   ═══════════════════════════════════════ */
function ConnectionsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: connData } = useQuery({
    queryKey: ['/api/social/connections'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/connections'); return await res.json(); }
      catch { return { connections: [] }; }
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: string) => {
      const res = await apiRequest('POST', '/api/social/connect', { platform });
      return res.json();
    },
    onSuccess: (_d, platform) => {
      qc.invalidateQueries({ queryKey: ['/api/social/connections'] });
      toast({ title: 'Connected!', description: `${platform} linked to your account.` });
    },
    onError: () => toast({ title: 'Connection Failed', variant: 'destructive' }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (platform: string) => {
      const res = await apiRequest('DELETE', `/api/social/connect/${platform}`);
      return res.json();
    },
    onSuccess: (_d, platform) => {
      qc.invalidateQueries({ queryKey: ['/api/social/connections'] });
      toast({ title: 'Disconnected', description: `${platform} removed.` });
    },
    onError: () => toast({ title: 'Disconnect Failed', variant: 'destructive' }),
  });

  const connections = connData?.connections || [];
  const isConnected = (platformId: string) => connections.some((c: any) => c.platform === platformId && c.connected);

  return (
    <div className="space-y-4">
      <div className="text-sm text-cyan-400/60 mb-2">Connect your social accounts to share your music across platforms.</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map(p => {
          const connected = isConnected(p.id);
          const conn = connections.find((c: any) => c.platform === p.id);
          return (
            <div key={p.id} className={`rounded-xl border p-5 transition-all ${connected ? 'border-green-500/30 bg-green-500/5' : 'border-cyan-500/15 bg-black/30'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${connected ? 'bg-green-500/15 text-green-400' : 'bg-cyan-500/10 text-cyan-400'}`}>{p.icon}</div>
                  <div>
                    <h3 className="text-cyan-100 font-bold">{p.name}</h3>
                    <p className="text-cyan-500/40 text-xs">{p.description}</p>
                  </div>
                </div>
                <Badge className={connected ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-cyan-500/10 text-cyan-500/50 border-cyan-500/20'}>
                  {connected ? <><Wifi className="h-3 w-3 mr-1" /> Connected</> : <><WifiOff className="h-3 w-3 mr-1" /> Offline</>}
                </Badge>
              </div>
              {conn?.platformUsername && <div className="text-cyan-300/60 text-xs mb-3">@{conn.platformUsername}</div>}
              <div className="flex items-center justify-between">
                <div className="text-xs text-cyan-500/40">{conn?.followers || 0} followers</div>
                {connected ? (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => disconnectMutation.mutate(p.id)}
                    disabled={disconnectMutation.isPending}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                  >
                    <WifiOff className="h-3 w-3 mr-1" /> Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => connectMutation.mutate(p.id)}
                    disabled={connectMutation.isPending}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                  >
                    <Wifi className="h-3 w-3 mr-1" /> Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Share to Connected Platforms */}
      {connections.some((c: any) => c.connected) && (
        <div className="rounded-xl border border-cyan-500/15 bg-black/30 p-5 mt-4">
          <h3 className="text-cyan-100 font-bold text-sm mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" /> Quick Share</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { type: 'beat', label: 'Share Beat', emoji: '\uD83E\uDD41' },
              { type: 'melody', label: 'Share Melody', emoji: '\uD83C\uDFBC' },
              { type: 'code', label: 'Code\u2192Music', emoji: '\uD83D\uDCBB' },
              { type: 'project', label: 'Share Project', emoji: '\uD83C\uDFB5' },
            ].map(item => (
              <Button
                key={item.type}
                size="sm" variant="outline"
                onClick={() => {
                  const connectedPlatforms = connections.filter((c: any) => c.connected).map((c: any) => c.platform);
                  const platform = connectedPlatforms[0] || 'codedswitch';
                  connectMutation.mutate(platform);
                }}
                className="border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10 text-xs"
              >
                {item.emoji} {item.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   CHAT TAB
   ═══════════════════════════════════════ */
function ChatTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: convData } = useQuery({
    queryKey: ['/api/social/chat/conversations'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/chat/conversations'); return await res.json(); }
      catch { return { conversations: [] }; }
    },
    refetchInterval: 5000,
  });

  const { data: msgData } = useQuery({
    queryKey: ['/api/social/chat/conversation', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return { messages: [] };
      try { const res = await apiRequest('GET', `/api/social/chat/conversation/${selectedUserId}`); return await res.json(); }
      catch { return { messages: [] }; }
    },
    enabled: !!selectedUserId,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { recipientId: string; content: string }) => {
      const res = await apiRequest('POST', '/api/social/chat/send', data);
      return res.json();
    },
    onSuccess: () => {
      setMsgInput('');
      qc.invalidateQueries({ queryKey: ['/api/social/chat/conversation', selectedUserId] });
      qc.invalidateQueries({ queryKey: ['/api/social/chat/conversations'] });
    },
    onError: () => toast({ title: 'Send Failed', variant: 'destructive' }),
  });

  const handleSend = () => {
    if (!msgInput.trim() || !selectedUserId) return;
    sendMutation.mutate({ recipientId: selectedUserId, content: msgInput });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgData]);

  const conversations = convData?.conversations || [];
  const messages = [...(msgData?.messages || [])].reverse();

  return (
    <div className="flex rounded-xl border border-cyan-500/15 bg-black/30 overflow-hidden" style={{ height: 500 }}>
      {/* Conversation List */}
      <div className="w-72 border-r border-cyan-500/10 flex flex-col">
        <div className="p-3 border-b border-cyan-500/10">
          <h3 className="text-cyan-100 font-bold text-sm">Messages</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? conversations.map((conv: any) => (
            <button
              key={conv.conversationId}
              onClick={() => { setSelectedConv(conv.conversationId); setSelectedUserId(conv.otherUserId); }}
              className={`w-full text-left p-3 border-b border-cyan-500/5 hover:bg-cyan-500/5 transition-colors ${selectedConv === conv.conversationId ? 'bg-cyan-500/10' : ''}`}
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-purple-700 text-white text-xs font-bold">
                    {(conv.otherUserName || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-100 font-medium text-xs truncate">{conv.otherUserName}</span>
                    {conv.unreadCount > 0 && (
                      <Badge className="bg-cyan-500 text-white text-[9px] px-1.5 py-0 min-w-[18px] text-center">{conv.unreadCount}</Badge>
                    )}
                  </div>
                  <p className="text-cyan-500/40 text-[11px] truncate">{conv.lastMessage}</p>
                </div>
              </div>
            </button>
          )) : (
            <div className="p-6 text-center text-cyan-500/30 text-xs">No conversations yet. Visit Discover to find people to chat with!</div>
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedUserId ? (
          <>
            <div className="p-3 border-b border-cyan-500/10">
              <span className="text-cyan-100 font-bold text-sm">
                {conversations.find((c: any) => c.conversationId === selectedConv)?.otherUserName || 'Chat'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.recipientId === selectedUserId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${msg.recipientId === selectedUserId ? 'bg-cyan-600/30 text-cyan-100' : 'bg-black/40 text-cyan-200/80 border border-cyan-500/10'}`}>
                    {msg.content}
                    <div className="text-[9px] text-cyan-500/30 mt-1">{formatTimeAgo(msg.createdAt)}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t border-cyan-500/10">
              <div className="flex gap-2">
                <Input
                  id="social-msg-input"
                  name="social-msg-input"
                  autoComplete="off"
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="bg-black/30 border-cyan-500/20 text-cyan-100 placeholder:text-cyan-500/30 text-sm"
                />
                <Button size="sm" onClick={handleSend} disabled={!msgInput.trim() || sendMutation.isPending} className="bg-cyan-600 hover:bg-cyan-500">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-cyan-500/30 text-sm">
            <div className="text-center">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   COLLABS TAB
   ═══════════════════════════════════════ */
function CollabsTab() {
  const { data: sharedData } = useQuery({
    queryKey: ['/api/social/shared-with-me'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/shared-with-me'); return await res.json(); }
      catch { return { shares: [] }; }
    },
  });

  const { data: followersData } = useQuery({
    queryKey: ['/api/social/followers'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/followers'); return await res.json(); }
      catch { return { followers: [] }; }
    },
  });

  const { data: followingData } = useQuery({
    queryKey: ['/api/social/following'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/following'); return await res.json(); }
      catch { return { following: [] }; }
    },
  });

  const shares = sharedData?.shares || [];
  const followers = followersData?.followers || [];
  const following = followingData?.following || [];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-cyan-500/10 bg-black/30 p-4 text-center">
          <div className="text-2xl font-black text-cyan-300">{followers.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-cyan-500/50">Followers</div>
        </div>
        <div className="rounded-lg border border-cyan-500/10 bg-black/30 p-4 text-center">
          <div className="text-2xl font-black text-purple-300">{following.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-cyan-500/50">Following</div>
        </div>
        <div className="rounded-lg border border-cyan-500/10 bg-black/30 p-4 text-center">
          <div className="text-2xl font-black text-green-300">{shares.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-cyan-500/50">Shared Projects</div>
        </div>
      </div>

      {/* Shared With Me */}
      <div className="rounded-xl border border-cyan-500/15 bg-black/30 p-5">
        <h3 className="text-cyan-100 font-bold text-sm mb-3 flex items-center gap-2"><Handshake className="h-4 w-4 text-green-400" /> Projects Shared With You</h3>
        {shares.length > 0 ? (
          <div className="space-y-2">
            {shares.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-cyan-500/10 bg-black/20">
                <div>
                  <div className="text-cyan-100 text-sm font-medium">Project #{s.projectId?.slice(0, 8)}</div>
                  <div className="text-cyan-500/40 text-xs">Permission: {s.permission} | {formatTimeAgo(s.createdAt)}</div>
                </div>
                <Badge className="bg-green-500/15 text-green-400 border-green-500/20 text-xs">{s.permission}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-cyan-500/30 text-sm">No projects shared with you yet. Collaborate with others to get started!</p>
        )}
      </div>

      {/* Following List */}
      <div className="rounded-xl border border-cyan-500/15 bg-black/30 p-5">
        <h3 className="text-cyan-100 font-bold text-sm mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-purple-400" /> People You Follow</h3>
        {following.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {following.map((u: any) => (
              <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg border border-cyan-500/10 bg-black/20">
                <Avatar className="h-7 w-7"><AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600 text-white text-[10px] font-bold">{(u.name || '?').charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                <span className="text-cyan-200 text-xs truncate">{u.name || u.email}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-cyan-500/30 text-sm">You're not following anyone yet. Visit Discover to find producers!</p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   BLOG TAB
   ═══════════════════════════════════════ */
function BlogTab() {
  const { data: posts, isLoading } = useQuery<any[]>({
    queryKey: ['/api/blog/posts'],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-cyan-100 font-bold text-sm flex items-center gap-2"><BookOpen className="h-4 w-4 text-yellow-400" /> CodedSwitch Blog</h3>
        <Link href="/blog">
          <Button size="sm" variant="outline" className="border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10 text-xs">
            View Full Blog
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-cyan-500/50">Loading posts...</div>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-3">
          {posts.slice(0, 6).map((post: any) => (
            <Link key={post.id} href={`/blog/${post.slug}`}>
              <div className="rounded-xl border border-cyan-500/10 bg-black/30 p-4 hover:border-cyan-500/25 transition-all cursor-pointer group">
                <div className="flex items-start gap-4">
                  {post.imageUrl && (
                    <div className="w-20 h-20 rounded-lg bg-cyan-500/10 overflow-hidden shrink-0">
                      <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-cyan-100 font-bold text-sm group-hover:text-cyan-300 transition-colors mb-1">{post.title}</h4>
                    <p className="text-cyan-500/50 text-xs line-clamp-2 mb-2">{post.excerpt}</p>
                    <div className="flex items-center gap-3 text-[10px] text-cyan-500/30">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(post.publishedAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {post.readTime} min read</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {post.views} views</span>
                      <Badge className="bg-cyan-500/10 text-cyan-400/60 border-cyan-500/15 text-[9px] px-1">{post.category}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-cyan-500/10 bg-black/30 p-12 text-center">
          <BookOpen className="h-10 w-10 text-cyan-500/20 mx-auto mb-3" />
          <h3 className="text-cyan-100 font-bold mb-1">No Blog Posts Yet</h3>
          <p className="text-cyan-500/40 text-sm">Check back soon for tutorials, tips, and music production insights!</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   DISCOVER TAB
   ═══════════════════════════════════════ */
function DiscoverTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: discoverData, isLoading } = useQuery({
    queryKey: ['/api/social/discover'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/discover?limit=20'); return await res.json(); }
      catch { return { users: [] }; }
    },
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest('POST', `/api/social/follow/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/social/discover'] });
      qc.invalidateQueries({ queryKey: ['/api/social/following'] });
      toast({ title: 'Followed!', description: 'You are now following this user.' });
    },
    onError: (e: any) => toast({ title: 'Follow Failed', description: e?.message || 'Could not follow user.', variant: 'destructive' }),
  });

  const users = discoverData?.users || [];

  return (
    <div className="space-y-4">
      <div className="text-sm text-cyan-400/60 mb-2">Find other CodedSwitch producers to follow, chat with, and collaborate.</div>

      {isLoading ? (
        <div className="text-center py-12 text-cyan-500/50">Discovering users...</div>
      ) : users.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {users.map((u: any) => (
            <div key={u.id} className="rounded-xl border border-cyan-500/10 bg-black/30 p-4 flex items-center justify-between hover:border-cyan-500/20 transition-colors">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-cyan-600 to-purple-700 text-white text-sm font-bold">
                    {(u.name || u.email || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-cyan-100 font-bold text-sm">{u.name || 'Producer'}</div>
                  <div className="text-cyan-500/40 text-xs">{u.email}</div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => followMutation.mutate(u.id)}
                disabled={followMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                <UserPlus className="h-3 w-3 mr-1" /> Follow
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-cyan-500/10 bg-black/30 p-12 text-center">
          <Users className="h-10 w-10 text-cyan-500/20 mx-auto mb-3" />
          <h3 className="text-cyan-100 font-bold mb-1">No New Users to Discover</h3>
          <p className="text-cyan-500/40 text-sm">You're following everyone! Invite friends to join CodedSwitch.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   ANALYTICS TAB
   ═══════════════════════════════════════ */
function AnalyticsTab() {
  const { data: statsData } = useQuery({
    queryKey: ['/api/social/stats'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/stats'); return await res.json(); }
      catch { return { followers: 0, following: 0, sharedProjectsCount: 0 }; }
    },
  });

  const { data: feedData } = useQuery({
    queryKey: ['/api/social/posts'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/posts'); return await res.json(); }
      catch { return { posts: [], stats: null }; }
    },
  });

  const { data: connData } = useQuery({
    queryKey: ['/api/social/connections'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/connections'); return await res.json(); }
      catch { return { connections: [] }; }
    },
  });

  const { data: unreadData } = useQuery({
    queryKey: ['/api/social/chat/unread'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/chat/unread'); return await res.json(); }
      catch { return { unreadCount: 0 }; }
    },
  });

  const s = feedData?.stats || {};
  const connectedCount = (connData?.connections || []).filter((c: any) => c.connected).length;

  return (
    <div className="space-y-5">
      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Followers', value: statsData?.followers || 0, icon: <Users className="h-5 w-5" />, color: 'from-cyan-500 to-blue-600' },
          { label: 'Following', value: statsData?.following || 0, icon: <UserPlus className="h-5 w-5" />, color: 'from-purple-500 to-pink-600' },
          { label: 'Posts', value: s.totalShares || 0, icon: <Share2 className="h-5 w-5" />, color: 'from-green-500 to-emerald-600' },
          { label: 'Unread', value: unreadData?.unreadCount || 0, icon: <MessageCircle className="h-5 w-5" />, color: 'from-yellow-500 to-orange-600' },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-cyan-500/10 bg-black/30 p-5 text-center">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white mx-auto mb-2`}>{item.icon}</div>
            <div className="text-2xl font-black text-white">{item.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-500/40 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Engagement Stats */}
      <div className="rounded-xl border border-cyan-500/15 bg-black/30 p-5">
        <h3 className="text-cyan-100 font-bold text-sm mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-400" /> Engagement</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Views', value: s.totalViews || 0, color: 'text-blue-400' },
            { label: 'Total Likes', value: s.totalLikes || 0, color: 'text-pink-400' },
            { label: 'Total Comments', value: s.totalComments || 0, color: 'text-yellow-400' },
            { label: 'Shared Projects', value: statsData?.sharedProjectsCount || 0, color: 'text-green-400' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <div className={`text-3xl font-black ${item.color}`}>{item.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-cyan-500/40 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Connections */}
      <div className="rounded-xl border border-cyan-500/15 bg-black/30 p-5">
        <h3 className="text-cyan-100 font-bold text-sm mb-3 flex items-center gap-2"><Wifi className="h-4 w-4 text-cyan-400" /> Connected Platforms</h3>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-black text-cyan-300">{connectedCount}</div>
          <div className="text-cyan-500/50 text-sm">of {PLATFORMS.length} platforms connected</div>
        </div>
        <div className="flex gap-2 mt-3">
          {PLATFORMS.map(p => {
            const isConn = (connData?.connections || []).some((c: any) => c.platform === p.id && c.connected);
            return (
              <div key={p.id} className={`p-2 rounded-lg ${isConn ? 'bg-green-500/15 text-green-400' : 'bg-cyan-500/5 text-cyan-500/20'}`}>
                {p.icon}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN SOCIAL HUB COMPONENT
   ═══════════════════════════════════════ */
export default function SocialHub() {
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>('feed');

  const isAuthenticated = auth?.isAuthenticated || false;

  const { data: unreadData } = useQuery({
    queryKey: ['/api/social/chat/unread'],
    queryFn: async () => {
      try { const res = await apiRequest('GET', '/api/social/chat/unread'); return await res.json(); }
      catch { return { unreadCount: 0 }; }
    },
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black/95 astutely-app astutely-scanlines astutely-grid-bg">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <Share2 className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-white tracking-tight">Social Hub</h1>
              <p className="text-cyan-400/50 text-xs tracking-wider">What producers are creating right now</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setLocation('/login')} variant="outline" className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-xs">Sign In</Button>
              <Button size="sm" onClick={() => setLocation('/signup')} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">Sign Up Free</Button>
            </div>
          </div>

          {/* Public feed */}
          <FeedTab isAuthenticated={false} />

          {/* Sticky CTA banner */}
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-cyan-900/95 to-purple-900/95 border-t border-cyan-500/20 backdrop-blur-xl p-4 z-50">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
              <div>
                <div className="text-white font-bold text-sm">Create your own →</div>
                <div className="text-cyan-400/60 text-xs">Try the AI Organism for free. No account needed.</div>
              </div>
              <Link href="/organism">
                <Button className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-sm border-0 shrink-0">
                  Try Organism Free
                </Button>
              </Link>
            </div>
          </div>
          {/* Spacer for sticky CTA */}
          <div className="h-24" />
        </div>
      </div>
    );
  }

  const unreadCount = unreadData?.unreadCount || 0;

  const renderTab = () => {
    switch (activeTab) {
      case 'feed': return <FeedTab isAuthenticated={isAuthenticated} />;
      case 'connections': return <ConnectionsTab />;
      case 'chat': return <ChatTab />;
      case 'collabs': return <CollabsTab />;
      case 'blog': return <BlogTab />;
      case 'discover': return <DiscoverTab />;
      case 'analytics': return <AnalyticsTab />;
    }
  };

  return (
    <div className="min-h-screen bg-black/95 astutely-app astutely-scanlines astutely-grid-bg">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <Share2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Social Hub</h1>
            <p className="text-cyan-400/50 text-xs tracking-wider">Connect. Share. Collaborate. Create.</p>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1 border-b border-cyan-500/10">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all rounded-t-lg relative ${
                activeTab === tab.id
                  ? 'text-cyan-300 bg-cyan-500/10 border-b-2 border-cyan-400'
                  : 'text-cyan-500/40 hover:text-cyan-400 hover:bg-cyan-500/5'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'chat' && unreadCount > 0 && (
                <Badge className="bg-cyan-500 text-white text-[8px] px-1 py-0 min-w-[16px] text-center ml-1">{unreadCount}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {renderTab()}
      </div>
    </div>
  );
}
