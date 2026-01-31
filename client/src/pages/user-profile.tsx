import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import {
  User, Settings, Trophy, Star, Music, Share2,
  Twitter, Instagram, Youtube, Award, Zap, CreditCard, Download
} from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio: string;
  avatar: string;
  followers: number;
  following: number;
  totalShares: number;
  totalViews: number;
  rating: number;
  level: number;
  achievements: string[];
  socialLinks: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  subscription?: {
    tier: string;
    hasActiveSubscription: boolean;
    lastUsageReset?: string;
  };
  credits: number;
  joinDate: string;
  isActive: boolean;
}

export default function UserProfile() {
  const { toast } = useToast();
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  
  // Fetch user profile data
  const { data: profileData, isLoading, refetch } = useQuery({
    queryKey: ['/api/user/profile'],
    queryFn: () => apiRequest('GET', '/api/user/profile').then(res => res.json()),
    enabled: auth?.isAuthenticated,
  });

  // Fetch user credits
  const { data: creditData } = useQuery({
    queryKey: ['/api/credits/balance'],
    queryFn: () => apiRequest('GET', '/api/credits/balance').then(res => res.json()),
    enabled: auth?.isAuthenticated,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: Partial<UserProfile>) => {
      const response = await apiRequest('PUT', '/api/user/profile', profileData);
      return response.json();
    },
    onSuccess: () => {
      refetch();
      setIsEditing(false);
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been saved successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });

  // Default profile data for unauthenticated users
  const defaultProfile: UserProfile = {
    id: 'guest',
    username: 'guest_user',
    displayName: 'Guest User',
    email: 'guest@example.com',
    bio: 'Sign up to create your profile and start sharing your music creations!',
    avatar: '',
    followers: 0,
    following: 0,
    totalShares: 0,
    totalViews: 0,
    rating: 0,
    level: 1,
    achievements: [],
    socialLinks: {},
    credits: 0,
    joinDate: new Date().toISOString(),
    isActive: false,
  };

  const profile = profileData || defaultProfile;
  const credits = creditData?.balance || 0;
  const isAuthenticated = auth?.isAuthenticated || false;

  const handleSave = () => {
    updateProfileMutation.mutate({
      displayName: profile.displayName,
      bio: profile.bio,
      socialLinks: profile.socialLinks,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="bg-gray-800/50 border-gray-600">
            <CardContent className="p-12 text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-4xl font-bold mx-auto mb-6">
                ?
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">Sign In Required</h1>
              <p className="text-gray-300 mb-8 max-w-md mx-auto">
                Please sign in to view and edit your profile. Create an account to start sharing your music creations!
              </p>
              <div className="space-x-4">
                <Button onClick={() => setLocation('/login')} className="bg-blue-600 hover:bg-blue-700">
                  Sign In
                </Button>
                <Button onClick={() => setLocation('/signup')} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                  Sign Up
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6 flex items-center justify-center">
        <div className="text-white text-xl">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Profile Header */}
        <Card className="bg-gray-800/50 border-gray-600">
          <CardContent className="p-6">
            <div className="flex items-start space-x-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile.avatar} />
                <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-2xl">
                  {profile.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-3xl font-bold text-white">{profile.displayName}</h1>
                  <Button
                    onClick={() => setIsEditing(!isEditing)}
                    variant="outline"
                    className="bg-gray-700 hover:bg-gray-600"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {isEditing ? 'Cancel' : 'Edit Profile'}
                  </Button>
                </div>

                <p className="text-gray-300 mb-4">@{profile.username}</p>

                <div className="flex items-center space-x-6 mb-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">{profile.followers.toLocaleString()}</div>
                    <div className="text-sm text-gray-400">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">{profile.following}</div>
                    <div className="text-sm text-gray-400">Following</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">{profile.totalShares}</div>
                    <div className="text-sm text-gray-400">Shares</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">{profile.totalViews.toLocaleString()}</div>
                    <div className="text-sm text-gray-400">Views</div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 mb-4">
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                    <Trophy className="h-3 w-3 mr-1" />
                    Level {profile.level}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                    <Star className="h-3 w-3 mr-1" />
                    {profile.rating} Rating
                  </Badge>
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                    <CreditCard className="h-3 w-3 mr-1" />
                    {credits} Credits
                  </Badge>
                  {profile.subscription?.hasActiveSubscription && (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                      <Award className="h-3 w-3 mr-1" />
                      {profile.subscription.tier.toUpperCase()}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center space-x-4">
                  {profile.socialLinks.twitter && (
                    <Button size="sm" variant="outline" className="bg-blue-500/20 hover:bg-blue-500/30">
                      <Twitter className="h-3 w-3 mr-2" />
                      Twitter
                    </Button>
                  )}
                  {profile.socialLinks.instagram && (
                    <Button size="sm" variant="outline" className="bg-pink-500/20 hover:bg-pink-500/30">
                      <Instagram className="h-3 w-3 mr-2" />
                      Instagram
                    </Button>
                  )}
                  {profile.socialLinks.youtube && (
                    <Button size="sm" variant="outline" className="bg-red-500/20 hover:bg-red-500/30">
                      <Youtube className="h-3 w-3 mr-2" />
                      YouTube
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bio Section */}
        <Card className="bg-gray-800/50 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">About</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Display Name</label>
                    <Input
                      value={profile.displayName}
                      onChange={(e) => updateProfileMutation.mutate({...profile, displayName: e.target.value})}
                      placeholder="Enter display name"
                      className="bg-gray-700 border-gray-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Email</label>
                    <Input
                      value={profile.email}
                      disabled
                      className="bg-gray-700 border-gray-600 text-white mt-1 opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Bio</label>
                  <Input
                    value={profile.bio}
                    onChange={(e) => updateProfileMutation.mutate({...profile, bio: e.target.value})}
                    placeholder="Tell us about yourself..."
                    className="bg-gray-700 border-gray-600 text-white mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={updateProfileMutation.isPending} className="bg-green-600 hover:bg-green-700">
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button onClick={() => setIsEditing(false)} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-gray-300">{profile.bio}</p>
            )}
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <Card className="bg-gray-800/50 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Trophy className="h-5 w-5 mr-2" />
              Stats Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                <div className="text-2xl font-bold text-white">{profile.totalShares}</div>
                <div className="text-sm text-gray-400">Total Shares</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
                <div className="text-2xl font-bold text-white">{profile.totalViews.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Total Views</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                <div className="text-2xl font-bold text-white">{credits}</div>
                <div className="text-sm text-gray-400">Credits</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                <div className="text-2xl font-bold text-white">{profile.rating}</div>
                <div className="text-sm text-gray-400">Rating</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card className="bg-gray-800/50 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Award className="h-5 w-5 mr-2" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {profile.achievements.map((achievement: string, index: number) => (
                <div key={index} className="text-center p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                  <Trophy className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                  <div className="text-white font-medium">{achievement}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-gray-800/50 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Music className="h-5 w-5 mr-2" />
              Recent Creations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { type: 'Beat', title: 'Cyberpunk Trap Beat', time: '2 hours ago', plays: 1247 },
                { type: 'Melody', title: 'Ambient Piano Loop', time: '5 hours ago', plays: 892 },
                { type: 'Code→Music', title: 'React Component Synth', time: '1 day ago', plays: 2156 },
                { type: 'Project', title: 'Complete EDM Album', time: '2 days ago', plays: 5432 }
              ].map((creation, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-700/50 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {creation.type[0]}
                    </div>
                    <div>
                      <div className="text-white font-medium">{creation.title}</div>
                      <div className="text-sm text-gray-400">{creation.time}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">{creation.plays.toLocaleString()} plays</div>
                    <Button size="sm" variant="outline" className="mt-1">
                      <Share2 className="h-3 w-3 mr-1" />
                      Share
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-gray-800/50 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button onClick={() => setLocation('/social-hub')} className="bg-blue-600 hover:bg-blue-700">
                <Share2 className="h-4 w-4 mr-2" />
                Share Profile
              </Button>
              <Button onClick={() => setLocation('/studio')} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                <Music className="h-4 w-4 mr-2" />
                Create Beat
              </Button>
              <Button onClick={() => setIsEditing(true)} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                <User className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
              <Button onClick={() => setLocation('/settings')} variant="outline" className="bg-gray-700 hover:bg-gray-600">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-400">
                  Member since: {new Date(profile.joinDate).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setLocation('/buy-credits')} variant="outline" size="sm" className="bg-gray-700 hover:bg-gray-600">
                    <CreditCard className="h-3 w-3 mr-1" />
                    Buy Credits
                  </Button>
                  <Button onClick={() => setLocation('/billing')} variant="outline" size="sm" className="bg-gray-700 hover:bg-gray-600">
                    <Download className="h-3 w-3 mr-1" />
                    Billing
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
