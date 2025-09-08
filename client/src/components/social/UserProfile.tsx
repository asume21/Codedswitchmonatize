import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { User, MapPin, Link as LinkIcon, Music, Users, Star, Edit3, Save, X } from 'lucide-react';

interface UserProfile {
  id: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  websiteUrl: string;
  location: string;
  favoriteGenres: string[];
  instruments: string[];
  skillLevel: string;
  socialLinks: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    soundcloud?: string;
  };
  followersCount: number;
  followingCount: number;
  projectsCount: number;
}

export default function UserProfileComponent() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<Partial<UserProfile>>({
    displayName: '',
    bio: '',
    avatarUrl: '',
    websiteUrl: '',
    location: '',
    favoriteGenres: [],
    instruments: [],
    skillLevel: 'beginner',
    socialLinks: {}
  });

  // Fetch user profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/profile');
      return await response.json();
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const response = await apiRequest('PUT', '/api/user/profile', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully!"
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update profile",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (profile) {
      setProfileData(profile);
    }
  }, [profile]);

  const handleSave = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleCancel = () => {
    if (profile) {
      setProfileData(profile);
    }
    setIsEditing(false);
  };

  const addGenre = (genre: string) => {
    if (!profileData.favoriteGenres?.includes(genre)) {
      setProfileData(prev => ({
        ...prev,
        favoriteGenres: [...(prev.favoriteGenres || []), genre]
      }));
    }
  };

  const removeGenre = (genre: string) => {
    setProfileData(prev => ({
      ...prev,
      favoriteGenres: prev.favoriteGenres?.filter(g => g !== genre) || []
    }));
  };

  const addInstrument = (instrument: string) => {
    if (!profileData.instruments?.includes(instrument)) {
      setProfileData(prev => ({
        ...prev,
        instruments: [...(prev.instruments || []), instrument]
      }));
    }
  };

  const removeInstrument = (instrument: string) => {
    setProfileData(prev => ({
      ...prev,
      instruments: prev.instruments?.filter(i => i !== instrument) || []
    }));
  };

  const genres = [
    'Pop', 'Rock', 'Hip Hop', 'Electronic', 'Jazz', 'Classical',
    'Country', 'R&B', 'Reggae', 'Blues', 'Folk', 'Indie',
    'Ambient', 'Techno', 'House', 'Dubstep'
  ];

  const instrumentOptions = [
    'Piano', 'Guitar', 'Bass', 'Drums', 'Violin', 'Trumpet',
    'Saxophone', 'Flute', 'Cello', 'Keyboard', 'Vocals', 'DJ'
  ];

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto bg-gray-800 border-gray-600">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-xl">
            <User className="w-6 h-6 text-blue-400" />
            {isEditing ? 'Edit Profile' : 'My Profile'}
          </CardTitle>
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-500"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                className="bg-green-600 hover:bg-green-500"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                className="bg-gray-700 hover:bg-gray-600"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Avatar and Basic Info */}
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            {profileData.avatarUrl ? (
              <img
                src={profileData.avatarUrl}
                alt="Profile"
                className="w-24 h-24 rounded-full border-4 border-gray-600"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-600 flex items-center justify-center">
                <User className="w-12 h-12 text-gray-400" />
              </div>
            )}
            {isEditing && (
              <Button variant="outline" size="sm" className="mt-2 w-full">
                Change Photo
              </Button>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              {isEditing ? (
                <Input
                  id="displayName"
                  value={profileData.displayName || ''}
                  onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                  className="bg-gray-700 border-gray-600"
                />
              ) : (
                <p className="text-xl font-semibold">{profileData.displayName || 'Set your display name'}</p>
              )}
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              {isEditing ? (
                <Textarea
                  id="bio"
                  value={profileData.bio || ''}
                  onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell others about yourself..."
                  className="bg-gray-700 border-gray-600 min-h-[80px]"
                />
              ) : (
                <p className="text-gray-300">{profileData.bio || 'No bio yet'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-700 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{profileData.followersCount || 0}</div>
            <div className="text-sm text-gray-400">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{profileData.followingCount || 0}</div>
            <div className="text-sm text-gray-400">Following</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{profileData.projectsCount || 0}</div>
            <div className="text-sm text-gray-400">Projects</div>
          </div>
        </div>

        {/* Location and Website */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location
            </Label>
            {isEditing ? (
              <Input
                id="location"
                value={profileData.location || ''}
                onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, Country"
                className="bg-gray-700 border-gray-600"
              />
            ) : (
              <p className="text-gray-300">{profileData.location || 'Not specified'}</p>
            )}
          </div>

          <div>
            <Label htmlFor="website" className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Website
            </Label>
            {isEditing ? (
              <Input
                id="website"
                value={profileData.websiteUrl || ''}
                onChange={(e) => setProfileData(prev => ({ ...prev, websiteUrl: e.target.value }))}
                placeholder="https://yourwebsite.com"
                className="bg-gray-700 border-gray-600"
              />
            ) : (
              profileData.websiteUrl ? (
                <a href={profileData.websiteUrl} target="_blank" rel="noopener noreferrer"
                   className="text-blue-400 hover:text-blue-300">
                  {profileData.websiteUrl}
                </a>
              ) : (
                <p className="text-gray-400">No website</p>
              )
            )}
          </div>
        </div>

        {/* Skill Level */}
        <div>
          <Label htmlFor="skillLevel" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Skill Level
          </Label>
          {isEditing ? (
            <Select
              value={profileData.skillLevel || 'beginner'}
              onValueChange={(value) => setProfileData(prev => ({ ...prev, skillLevel: value }))}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="secondary" className="bg-blue-600">
              {profileData.skillLevel || 'beginner'}
            </Badge>
          )}
        </div>

        {/* Favorite Genres */}
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <Music className="w-4 h-4" />
            Favorite Genres
          </Label>
          <div className="flex flex-wrap gap-2">
            {profileData.favoriteGenres?.map(genre => (
              <Badge key={genre} variant="outline" className="bg-purple-600">
                {genre}
                {isEditing && (
                  <button
                    onClick={() => removeGenre(genre)}
                    className="ml-2 text-xs hover:text-red-300"
                  >
                    ×
                  </button>
                )}
              </Badge>
            ))}
            {isEditing && (
              <Select onValueChange={addGenre}>
                <SelectTrigger className="w-32 bg-gray-700 border-gray-600">
                  <SelectValue placeholder="Add..." />
                </SelectTrigger>
                <SelectContent>
                  {genres.filter(g => !profileData.favoriteGenres?.includes(g)).map(genre => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Instruments */}
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4" />
            Instruments
          </Label>
          <div className="flex flex-wrap gap-2">
            {profileData.instruments?.map(instrument => (
              <Badge key={instrument} variant="outline" className="bg-green-600">
                {instrument}
                {isEditing && (
                  <button
                    onClick={() => removeInstrument(instrument)}
                    className="ml-2 text-xs hover:text-red-300"
                  >
                    ×
                  </button>
                )}
              </Badge>
            ))}
            {isEditing && (
              <Select onValueChange={addInstrument}>
                <SelectTrigger className="w-32 bg-gray-700 border-gray-600">
                  <SelectValue placeholder="Add..." />
                </SelectTrigger>
                <SelectContent>
                  {instrumentOptions.filter(i => !profileData.instruments?.includes(i)).map(instrument => (
                    <SelectItem key={instrument} value={instrument}>{instrument}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Social Links */}
        {isEditing && (
          <div className="space-y-4">
            <Label>Social Links</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Twitter @username"
                value={profileData.socialLinks?.twitter || ''}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  socialLinks: { ...prev.socialLinks, twitter: e.target.value }
                }))}
                className="bg-gray-700 border-gray-600"
              />
              <Input
                placeholder="Instagram @username"
                value={profileData.socialLinks?.instagram || ''}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  socialLinks: { ...prev.socialLinks, instagram: e.target.value }
                }))}
                className="bg-gray-700 border-gray-600"
              />
              <Input
                placeholder="YouTube channel URL"
                value={profileData.socialLinks?.youtube || ''}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  socialLinks: { ...prev.socialLinks, youtube: e.target.value }
                }))}
                className="bg-gray-700 border-gray-600"
              />
              <Input
                placeholder="SoundCloud profile URL"
                value={profileData.socialLinks?.soundcloud || ''}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  socialLinks: { ...prev.socialLinks, soundcloud: e.target.value }
                }))}
                className="bg-gray-700 border-gray-600"
              />
            </div>
          </div>
        )}

        {/* Display Social Links */}
        {!isEditing && profileData.socialLinks && Object.keys(profileData.socialLinks).length > 0 && (
          <div>
            <Label className="mb-2 block">Social Links</Label>
            <div className="flex gap-4">
              {profileData.socialLinks.twitter && (
                <a href={`https://twitter.com/${profileData.socialLinks.twitter}`}
                   target="_blank" rel="noopener noreferrer"
                   className="text-blue-400 hover:text-blue-300">
                  Twitter
                </a>
              )}
              {profileData.socialLinks.instagram && (
                <a href={`https://instagram.com/${profileData.socialLinks.instagram}`}
                   target="_blank" rel="noopener noreferrer"
                   className="text-pink-400 hover:text-pink-300">
                  Instagram
                </a>
              )}
              {profileData.socialLinks.youtube && (
                <a href={profileData.socialLinks.youtube}
                   target="_blank" rel="noopener noreferrer"
                   className="text-red-400 hover:text-red-300">
                  YouTube
                </a>
              )}
              {profileData.socialLinks.soundcloud && (
                <a href={profileData.socialLinks.soundcloud}
                   target="_blank" rel="noopener noreferrer"
                   className="text-orange-400 hover:text-orange-300">
                  SoundCloud
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
