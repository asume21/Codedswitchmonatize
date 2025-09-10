import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Share2, Twitter, Facebook, Instagram, Youtube, Users, Trophy, Star } from 'lucide-react';

interface SocialFeature {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  followers: number;
}

export default function SocialHub() {
  const [user, setUser] = useState<any>(null);
  const [socialFeatures, setSocialFeatures] = useState<SocialFeature[]>([
    {
      id: 'twitter',
      name: 'Twitter/X',
      description: 'Share your beats on Twitter',
      icon: <Twitter className="h-5 w-5" />,
      enabled: true,
      followers: 1250
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Post your music to Instagram',
      icon: <Instagram className="h-5 w-5" />,
      enabled: true,
      followers: 2840
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Upload music videos',
      icon: <Youtube className="h-5 w-5" />,
      enabled: false,
      followers: 0
    },
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Share with your network',
      icon: <Facebook className="h-5 w-5" />,
      enabled: true,
      followers: 980
    }
  ]);

  const { toast } = useToast();

  const handleShare = (platform: string, content: string) => {
    try {
      const shareUrls = {
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}&url=${encodeURIComponent(window.location.href)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(content)}`,
        instagram: 'https://www.instagram.com/',
        youtube: 'https://www.youtube.com/upload'
      };

      if (shareUrls[platform as keyof typeof shareUrls]) {
        const url = shareUrls[platform as keyof typeof shareUrls];
        // Use a safer way to open links
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "Shared!",
          description: `Your creation shared to ${platform}`,
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      toast({
        title: "Share Error",
        description: "Unable to share at this time. Please try again.",
        variant: "destructive",
      });
    }
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

          <div className="flex items-center justify-center space-x-4 mb-6">
            <Badge variant="secondary" className="bg-green-500/20 text-green-400">
              <Users className="h-3 w-3 mr-1" />
              5,070 Followers
            </Badge>
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
              <Trophy className="h-3 w-3 mr-1" />
              Top Creator
            </Badge>
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
              <Star className="h-3 w-3 mr-1" />
              4.9 Rating
            </Badge>
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
                    onClick={() => handleShare('twitter', generateShareContent(item.type))}
                    className="w-full bg-blue-500 hover:bg-blue-600"
                  >
                    <Twitter className="h-4 w-4 mr-2" />
                    {item.icon} {item.label}
                  </Button>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShare('facebook', generateShareContent(item.type))}
                      className="flex-1"
                    >
                      <Facebook className="h-3 w-3 mr-1" />
                      FB
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShare('instagram', generateShareContent(item.type))}
                      className="flex-1"
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
                  <Badge variant={platform.enabled ? "default" : "secondary"}>
                    {platform.enabled ? 'Connected' : 'Not Connected'}
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
                    variant={platform.enabled ? "default" : "outline"}
                    onClick={() => {
                      if (!platform.enabled) {
                        toast({
                          title: "Connect Account",
                          description: `Connect your ${platform.name} account to start sharing`,
                        });
                      }
                    }}
                  >
                    {platform.enabled ? 'Share Now' : 'Connect'}
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
                <div className="text-2xl font-bold text-green-400">2,847</div>
                <div className="text-sm text-gray-400">Total Shares</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">12,543</div>
                <div className="text-sm text-gray-400">Total Views</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">856</div>
                <div className="text-sm text-gray-400">New Followers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">4.8</div>
                <div className="text-sm text-gray-400">Avg Rating</div>
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
            <div className="space-y-4">
              {[
                { type: 'Beat', title: 'Hip-Hop Beat #47', platform: 'Twitter', time: '2 hours ago', likes: 23 },
                { type: 'Melody', title: 'Jazz Piano Melody', platform: 'Instagram', time: '5 hours ago', likes: 67 },
                { type: 'Code→Music', title: 'React Code to Synth', platform: 'Twitter', time: '1 day ago', likes: 156 },
                { type: 'Project', title: 'Complete EDM Track', platform: 'YouTube', time: '2 days ago', likes: 89 }
              ].map((share, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {share.type[0]}
                    </div>
                    <div>
                      <div className="text-white font-medium">{share.title}</div>
                      <div className="text-sm text-gray-400">
                        {share.platform} • {share.time}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">{share.likes} likes</div>
                    <div className="text-sm text-gray-400">+{Math.floor(Math.random() * 50)} views</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
