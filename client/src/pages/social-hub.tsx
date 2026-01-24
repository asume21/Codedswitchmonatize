import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Share2, Twitter, Facebook, Instagram, Youtube, Users, Trophy, Star, Heart, MessageCircle, TrendingUp, Calendar } from 'lucide-react';

interface SocialFeature {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  followers: number;
  connected?: boolean;
  profileUrl?: string;
}

interface SocialPost {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  content: string;
  type: 'beat' | 'melody' | 'project' | 'share';
  title: string;
  url: string;
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  createdAt: string;
  isLiked?: boolean;
}

interface SocialStats {
  totalShares: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  weeklyGrowth: number;
  topPlatform: string;
}

export default function SocialHub() {
  const { toast } = useToast();
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [socialFeatures, setSocialFeatures] = useState<SocialFeature[]>([
    {
      id: 'twitter',
      name: 'Twitter/X',
      description: 'Share your beats on Twitter',
      icon: <Twitter className="h-5 w-5" />,
      enabled: false,
      followers: 0,
      connected: false,
      profileUrl: ''
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Post your music to Instagram',
      icon: <Instagram className="h-5 w-5" />,
      enabled: false,
      followers: 0,
      connected: false,
      profileUrl: ''
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Upload music videos',
      icon: <Youtube className="h-5 w-5" />,
      enabled: false,
      followers: 0,
      connected: false,
      profileUrl: ''
    },
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Share with your network',
      icon: <Facebook className="h-5 w-5" />,
      enabled: false,
      followers: 0,
      connected: false,
      profileUrl: ''
    }
  ]);
  const [recentPosts, setRecentPosts] = useState<SocialPost[]>([]);
  const [stats, setStats] = useState<SocialStats>({
    totalShares: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    weeklyGrowth: 0,
    topPlatform: 'None'
  });

  const isAuthenticated = auth?.isAuthenticated || false;

  // Fetch social stats
  const { data: socialData, refetch: refetchSocial } = useQuery({
    queryKey: ['/api/social/stats'],
    queryFn: () => apiRequest('GET', '/api/social/stats').then(res => res.json()),
    enabled: isAuthenticated,
  });

  // Fetch recent posts
  const { data: postsData } = useQuery({
    queryKey: ['/api/social/posts'],
    queryFn: () => apiRequest('GET', '/api/social/posts').then(res => res.json()),
    enabled: isAuthenticated,
  });

  // Share mutation
  const shareMutation = useMutation({
    mutationFn: async (data: { platform: string; content: string; type: string; title: string; url: string }) => {
      const response = await apiRequest('POST', '/api/social/share', data);
      return response.json();
    },
    onSuccess: () => {
      refetchSocial();
      toast({
        title: 'Shared Successfully!',
        description: 'Your creation has been shared to your social networks.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Share Failed',
        description: error.message || 'Unable to share at this time.',
        variant: 'destructive',
      });
    },
  });

  // Connect platform mutation
  const connectMutation = useMutation({
    mutationFn: async (platform: string) => {
      const response = await apiRequest('POST', '/api/social/connect', { platform });
      return response.json();
    },
    onSuccess: (data, variables) => {
      setSocialFeatures(prev => prev.map(feature => 
        feature.id === variables 
          ? { ...feature, connected: true, enabled: true }
          : feature
      ));
      toast({
        title: 'Platform Connected',
        description: `${variables} has been connected successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Connection Failed',
        description: error.message || 'Unable to connect platform.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (socialData) {
      setStats(socialData.stats);
      setRecentPosts(socialData.posts || []);
    }
  }, [socialData]);

  useEffect(() => {
    if (postsData) {
      setRecentPosts(postsData.posts || []);
    }
  }, [postsData]);

  const handleShare = async (platform: string, content: string, type: string, title: string) => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to share your creations.',
        variant: 'destructive',
      });
      setLocation('/login');
      return;
    }

    shareMutation.mutate({
      platform,
      content,
      type,
      title,
      url: window.location.href,
    });
  };

  const handleConnect = (platform: string) => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to connect social platforms.',
        variant: 'destructive',
      });
      setLocation('/login');
      return;
    }

    connectMutation.mutate(platform);
  };

  const handleLike = (postId: string) => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to like posts.',
        variant: 'destructive',
      });
      return;
    }

    // Toggle like
    setRecentPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
        : post
    ));
  };

  const generateShareContent = (type: string) => {
    const templates = {
      beat: "🎵 Just created an amazing beat with CodedSwitch! Check it out:",
      melody: "🎼 New melody composed with AI assistance! Listen here:",
      code: "💻 Transformed code into music using CodedSwitch! Mind-blowing:",
      project: "🎶 Finished a complete music project! Here's the result:"
    };
    return templates[type as keyof typeof templates] || "🎵 Amazing creation made with CodedSwitch!";
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-4xl font-bold mx-auto mb-6">
              <Share2 className="h-12 w-12" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Social Hub</h1>
            <p className="text-gray-300 text-lg mb-8">Share your creations and build your audience</p>
            <div className="space-x-4">
              <Button onClick={() => setLocation('/login')} className="bg-blue-600 hover:bg-blue-700">
                Sign In
              </Button>
              <Button onClick={() => setLocation('/signup')} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-4">
              <Share2 className="text-white h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Social Hub</h1>
              <p className="text-gray-300">Share your creations and build your audience</p>
            </div>
          </div>

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                      <Users className="h-3 w-3 mr-1" />
                      {stats.totalShares.toLocaleString()} Shares
                    </Badge>
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {stats.weeklyGrowth > 0 ? `+${stats.weeklyGrowth}%` : '0%'} Growth
                    </Badge>
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                      <Star className="h-3 w-3 mr-1" />
                      {stats.topPlatform}
                    </Badge>
                  </div>
                  <Button 
                    onClick={() => refetchSocial()}
                    variant="outline" 
                    size="sm"
                    className="bg-gray-700 hover:bg-gray-600"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Refresh
                  </Button>
                </div>
        </div>

        {/* Quick Share */}
        <Card className="bg-gray-800/50 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Share2 className="h-5 w-5 mr-2" />
              Quick Share
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { type: 'beat', label: 'Share Beat', icon: '🥁' },
                { type: 'melody', label: 'Share Melody', icon: '🎼' },
                { type: 'code', label: 'Share Code→Music', icon: '💻' },
                { type: 'project', label: 'Share Project', icon: '🎵' }
              ].map((item) => (
                <div key={item.type} className="space-y-2">
                  <Button
                    onClick={() => handleShare('twitter', generateShareContent(item.type), item.type, item.label)}
                    className="w-full bg-blue-500 hover:bg-blue-600"
                    disabled={shareMutation.isPending}
                  >
                    <Twitter className="h-4 w-4 mr-2" />
                    {shareMutation.isPending ? 'Sharing...' : `${item.icon} ${item.label}`}
                  </Button>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShare('facebook', generateShareContent(item.type), item.type, item.label)}
                      className="flex-1"
                      disabled={shareMutation.isPending}
                    >
                      <Facebook className="h-3 w-3 mr-1" />
                      FB
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShare('instagram', generateShareContent(item.type), item.type, item.label)}
                      className="flex-1"
                      disabled={shareMutation.isPending}
                    >
                      <Instagram className="h-3 w-3 mr-1" />
                      IG
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Social Platforms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {socialFeatures.map((platform) => (
            <Card key={platform.id} className="bg-gray-800/50 border-gray-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    {platform.icon}
                    <span className="ml-2">{platform.name}</span>
                  </div>
                  <Badge variant={platform.connected ? "default" : "secondary"}>
                    {platform.connected ? 'Connected' : 'Not Connected'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">{platform.description}</p>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    {platform.followers.toLocaleString()} followers
                  </div>
                  <Button
                    size="sm"
                    variant={platform.connected ? "default" : "outline"}
                    onClick={() => platform.connected ? handleShare(platform.id, 'Check out my latest music creation!', 'share', 'Latest Creation') : handleConnect(platform.id)}
                    disabled={connectMutation.isPending || shareMutation.isPending}
                  >
                    {platform.connected ? 'Share Now' : connectMutation.isPending ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Analytics */}
        <Card className="bg-gray-800/50 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Social Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{stats.totalShares.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Total Shares</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.totalViews.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Total Views</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.totalLikes.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Total Likes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{stats.totalComments.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Total Comments</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Shares */}
        <Card className="bg-gray-800/50 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Recent Shares</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPosts.length > 0 ? (
              <div className="space-y-4">
                {recentPosts.slice(0, 5).map((post) => (
                  <div key={post.id} className="flex items-start justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={post.avatar} />
                        <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm">
                          {post.displayName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{post.displayName}</span>
                          <Badge variant="outline" className="text-xs bg-gray-600 border-gray-500">
                            {post.platform}
                          </Badge>
                        </div>
                        <div className="text-gray-300 text-sm mb-2">{post.content}</div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>{post.createdAt}</span>
                          <span>•</span>
                          <span>{post.likes} likes</span>
                          <span>•</span>
                          <span>{post.comments} comments</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleLike(post.id)}
                        className={post.isLiked ? 'text-red-500' : 'text-gray-400'}
                      >
                        <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-gray-400">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center">
                  <Share2 className="h-8 w-8 text-gray-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-white font-medium">No Recent Activity</h3>
                  <p className="text-gray-400 text-sm max-w-xs">
                    Your recent shares will appear here once you start sharing your creations!
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const element = document.getElementById('quick-share');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Make Your First Share
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
