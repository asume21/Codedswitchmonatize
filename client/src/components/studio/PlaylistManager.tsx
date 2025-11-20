import { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StudioAudioContext } from "@/pages/studio";
import type { Playlist, Song } from "../../../../shared/schema";

export default function PlaylistManager() {
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();
  const studioContext = useContext(StudioAudioContext);

  const { data: playlists, isLoading: playlistsLoading } = useQuery<Playlist[]>({
    queryKey: ['/api/playlists'],
    initialData: [],
  });

  const { data: songs } = useQuery<Song[]>({
    queryKey: ['/api/songs'],
    initialData: [],
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/playlists", {
        name,
        description: `Playlist created on ${new Date().toLocaleDateString()}`,
        isPublic: false,
      });
      return response.json();
    },
    onSuccess: (newPlaylist: Playlist) => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      setNewPlaylistName("");
      setShowCreateDialog(false);
      toast({
        title: "Playlist Created",
        description: `${newPlaylist.name} has been created!`,
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create playlist. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      const response = await apiRequest("DELETE", `/api/playlists/${playlistId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      toast({
        title: "Playlist Deleted",
        description: "Playlist has been removed from your library.",
      });
    },
  });

  const addSongToPlaylistMutation = useMutation({
    mutationFn: async ({ playlistId, songId }: { playlistId: string; songId: string }) => {
      const response = await apiRequest("POST", `/api/playlists/${playlistId}/songs/${songId}`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Song Added",
        description: "Song has been added to the playlist!",
      });
    },
  });

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast({
        title: "Invalid Name",
        description: "Please enter a playlist name.",
        variant: "destructive",
      });
      return;
    }
    createPlaylistMutation.mutate(newPlaylistName.trim());
  };

  const handleAddSongToPlaylist = (playlistId: string, songId: string) => {
    addSongToPlaylistMutation.mutate({ playlistId, songId });
  };

  const handleSetActivePlaylist = async (playlist: Playlist) => {
    try {
      // Fetch playlist songs
      const response = await apiRequest("GET", `/api/playlists/${playlist.id}/songs`, {});
      const playlistWithSongs = await response.json();
      
      // Set as active playlist in studio context
      studioContext.setCurrentPlaylist({
        ...playlist,
        songs: playlistWithSongs
      });
      studioContext.setCurrentPlaylistIndex(0);
      
      toast({
        title: "Active Playlist Set",
        description: `${playlist.name} is now your active playlist. Use the main play button to play it.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set active playlist.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-600 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-heading font-bold">Playlist Manager</h2>
          <div className="text-xs text-gray-400 px-2">
            <div>Organize your uploaded songs into playlists</div>
            {studioContext.currentPlaylist && (
              <div className="mt-1 text-studio-accent font-medium">
                🎵 Active: {studioContext.currentPlaylist.name}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-studio-accent hover:bg-blue-500">
                <i className="fas fa-plus mr-2"></i>
                Create Playlist
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-600">
              <DialogHeader>
                <DialogTitle>Create New Playlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Enter playlist name..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                  className="bg-gray-700 border-gray-600"
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreatePlaylist}
                    disabled={createPlaylistMutation.isPending}
                  >
                    {createPlaylistMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {playlists && playlists.length > 0 && (
            <Badge variant="secondary">{playlists.length} playlist{playlists.length > 1 ? 's' : ''}</Badge>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {playlistsLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <i className="fas fa-spinner fa-spin text-4xl text-blue-400 mb-4"></i>
              <p className="text-gray-400">Loading playlists...</p>
            </div>
          </div>
        ) : !playlists || playlists.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div className="max-w-md">
              <i className="fas fa-list-music text-6xl text-gray-600 mb-4"></i>
              <h3 className="text-xl font-semibold mb-2">No Playlists Created</h3>
              <p className="text-gray-400 mb-6">
                Create playlists to organize your uploaded songs. Group songs by genre, mood, 
                or project to keep your music library organized.
              </p>
              <div className="text-sm text-gray-500 space-y-2">
                <p><strong>Benefits of playlists:</strong></p>
                <p>• Organize songs by genre, mood, or project</p>
                <p>• Quick access to related tracks</p>
                <p>• Better workflow for music production</p>
                <p>• Share and collaborate on collections</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Playlists ({playlists.length})</h3>
            </div>

            <div className="grid gap-4">
              {playlists.map((playlist) => (
                <Card key={playlist.id} className="border-gray-600">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center">
                        <i className="fas fa-list-music mr-2 text-green-400"></i>
                        {playlist.name}
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleSetActivePlaylist(playlist)}
                          className="bg-studio-accent hover:bg-blue-500"
                        >
                          <i className="fas fa-play mr-1"></i>
                          Set Active
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deletePlaylistMutation.mutate(playlist.id)}
                          disabled={deletePlaylistMutation.isPending}
                        >
                          <i className="fas fa-trash mr-1"></i>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Created:</span>
                          <div className="font-semibold">
                            {playlist.createdAt ? new Date(playlist.createdAt).toLocaleDateString() : 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Songs:</span>
                          <div className="font-semibold">0 songs</div>
                        </div>
                      </div>
                      
                      {playlist.description && (
                        <p className="text-sm text-gray-400">{playlist.description}</p>
                      )}

                      {/* Quick add songs section */}
                      {songs && songs.length > 0 && (
                        <div className="border-t border-gray-600 pt-3">
                          <p className="text-sm font-semibold mb-2">Quick Add Songs:</p>
                          <div className="space-y-1">
                            {songs.slice(0, 3).map((song) => (
                              <div key={song.id} className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 truncate">{song.name}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAddSongToPlaylist(playlist.id, song.id)}
                                  disabled={addSongToPlaylistMutation.isPending}
                                  className="text-xs h-6 px-2"
                                >
                                  <i className="fas fa-plus mr-1"></i>
                                  Add
                                </Button>
                              </div>
                            ))}
                            {songs.length > 3 && (
                              <p className="text-xs text-gray-500">...and {songs.length - 3} more songs</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}