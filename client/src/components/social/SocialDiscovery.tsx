import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Search, TrendingUp, Users, Music, Star, Heart, Play, UserPlus, Filter } from 'lucide-react';

interface User {
  id: string;
  name: string;
  avatar?: string;
  bio: string;
  genres: string[];
  instruments: string[];
  skillLevel: string;
  followersCount: number;
  projectsCount: number;
  isFollowing: boolean;
}

interface Project {
  id: string;
  title: string;
  description: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  genre: string;
  likes: number;
  comments: number;
  plays: number;
  createdAt: Date;
  tags: string[];
  isLiked: boolean;
}

export default function SocialDiscovery() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'users' | 'projects'>('projects');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'newest' | 'popular'>('trending');

  // Fetch trending projects
  const { data: trendingProjects } = useQuery({
    queryKey: ['trendingProjects'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/discovery/trending');
      return await response.json();
    }
  });

  // Fetch suggested users
  const { data: suggestedUsers } = useQuery({
    queryKey: ['suggestedUsers'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/discovery/suggested-users');
      return await response.json();
    }
  });

  // Search results
  const { data: searchResults, refetch: refetchSearch } = useQuery({
    queryKey: ['search', searchQuery, searchType, selectedGenre],
    queryFn: async () => {
      if (!searchQuery.trim()) return null;
      const response = await apiRequest('GET', `/api/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}&genre=${selectedGenre}`);
      return await response.json();
    },
    enabled: searchQuery.length > 2
  });

  const handleFollow = async (userId: string) => {
    try {
      await apiRequest('POST', `/api/users/${userId}/follow`);
      toast({
        title: "Following",
        description: "You are now following this musician"
      });
      // Refetch data to update UI
    } catch (error: any) {
      toast({
        title: "Follow Failed",
        description: error.message || "Could not follow user",
        variant: "destructive"
      });
    }
  };

  const handleLike = async (projectId: string) => {
    try {
      await apiRequest('POST', `/api/projects/${projectId}/like`);
      toast({
        title: "Liked",
        description: "Project added to your likes"
      });
      // Refetch data to update UI
    } catch (error: any) {
      toast({
        title: "Like Failed",
        description: error.message || "Could not like project",
        variant: "destructive"
      });
    }
  };

  const genres = [
    'Pop', 'Rock', 'Hip Hop', 'Electronic', 'Jazz', 'Classical',
    'Country', 'R&B', 'Reggae', 'Blues', 'Folk', 'Indie',
    'Ambient', 'Techno', 'House', 'Dubstep'
  ];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          🎵 Discover Music & Musicians
        </h1>
        <p className="text-gray-400 mt-2">
          Find inspiration, connect with creators, and explore amazing music
        </p>
      </div>

      {/* Search Bar */}
      <Card className="bg-gray-800 border-gray-600">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search for music, artists, or genres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600"
                />
              </div>
            </div>

            <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
              <SelectTrigger className="w-32 bg-gray-700 border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="projects">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Projects
                  </div>
                </SelectItem>
                <SelectItem value="users">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Musicians
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-32 bg-gray-700 border-gray-600">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {genres.map(genre => (
                  <SelectItem key={genre} value={genre.toLowerCase()}>{genre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {searchQuery && searchResults && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="font-semibold mb-2">Search Results</h3>
              <p className="text-sm text-gray-400">
                Found {searchResults.length} {searchType}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trending Projects */}
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-orange-400" />
                  Trending This Week
                </CardTitle>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-32 bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trending">Trending</SelectItem>
                    <SelectItem value="popular">Popular</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {trendingProjects?.slice(0, 6).map((project: Project) => (
                  <Card key={project.id} className="bg-gray-700 border-gray-600">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={project.author.avatar} alt={project.author.name} />
                            <AvatarFallback>{project.author.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold">{project.title}</h4>
                            <p className="text-sm text-gray-400">by {project.author.name}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-blue-600">
                          {project.genre}
                        </Badge>
                      </div>

                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                        {project.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {project.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {project.comments}
                          </span>
                          <span className="flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            {project.plays}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleLike(project.id)}
                            variant="outline"
                            size="sm"
                            className={project.isLiked ? "text-red-400" : ""}
                          >
                            <Heart className={`w-3 h-3 ${project.isLiked ? "fill-current" : ""}`} />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Play className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Suggested Musicians */}
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Users className="w-6 h-6 text-green-400" />
                Musicians to Follow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestedUsers?.slice(0, 5).map((user: User) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium text-sm">{user.name}</h4>
                        <div className="flex gap-1 mt-1">
                          {user.genres.slice(0, 2).map(genre => (
                            <Badge key={genre} variant="outline" className="text-xs px-1 py-0">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleFollow(user.id)}
                      variant="outline"
                      size="sm"
                      disabled={user.isFollowing}
                      className="bg-green-600 hover:bg-green-500 text-white"
                    >
                      {user.isFollowing ? <Star className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Discovery Tips */}
          <Card className="bg-blue-900/20 border-blue-600/30">
            <CardContent className="p-4">
              <h4 className="font-semibold text-blue-400 mb-3">💡 Discovery Tips</h4>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>• Follow musicians whose style inspires you</li>
                <li>• Like projects to show appreciation</li>
                <li>• Comment to give constructive feedback</li>
                <li>• Explore different genres to expand your taste</li>
                <li>• Share your own projects to get discovered</li>
              </ul>
            </CardContent>
          </Card>

          {/* Genre Filter */}
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-purple-400" />
                Filter by Genre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {genres.map(genre => (
                  <Badge
                    key={genre}
                    variant={selectedGenre === genre.toLowerCase() ? "default" : "outline"}
                    className={`cursor-pointer transition-colors ${
                      selectedGenre === genre.toLowerCase()
                        ? "bg-purple-600"
                        : "hover:bg-purple-600/30"
                    }`}
                    onClick={() => setSelectedGenre(
                      selectedGenre === genre.toLowerCase() ? 'all' : genre.toLowerCase()
                    )}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
