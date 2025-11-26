import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Share2, Music, User, Calendar, Clock } from "lucide-react";

interface PublicSong {
  id: string;
  name: string;
  accessibleUrl: string;
  duration: number | null;
  genre: string | null;
  mood: string | null;
  uploadDate: string;
  artistName: string;
}

export default function PublicSongPage() {
  const [, params] = useRoute("/s/:id");
  const songId = params?.id;

  const [song, setSong] = useState<PublicSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!songId) return;

    const fetchSong = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/songs/public/${songId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Song not found");
          } else if (response.status === 403) {
            setError("This song is not public");
          } else {
            setError("Failed to load song");
          }
          return;
        }

        const data = await response.json();
        setSong(data);
      } catch (err) {
        setError("Failed to load song");
      } finally {
        setLoading(false);
      }
    };

    fetchSong();
  }, [songId]);

  useEffect(() => {
    if (song?.accessibleUrl && audioRef.current) {
      audioRef.current.src = song.accessibleUrl;
    }
  }, [song?.accessibleUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: song?.name || "Check out this song",
          text: `Listen to "${song?.name}" by ${song?.artistName} on CodedSwitch`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Card className="bg-gray-800/50 border-gray-700 max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <Music className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              {error || "Song not found"}
            </h1>
            <p className="text-gray-400 mb-6">
              This song may have been removed or made private.
            </p>
            <Button
              onClick={() => (window.location.href = "/")}
              className="bg-purple-600 hover:bg-purple-500"
            >
              Go to CodedSwitch
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <Card className="bg-gray-800/80 backdrop-blur border-gray-700 max-w-lg w-full">
        <CardContent className="p-8">
          {/* Header with logo */}
          <div className="flex items-center justify-between mb-6">
            <a href="/" className="flex items-center gap-2 text-purple-400 hover:text-purple-300">
              <Music className="w-6 h-6" />
              <span className="font-bold">CodedSwitch</span>
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="text-gray-400 hover:text-white"
            >
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </Button>
          </div>

          {/* Song artwork placeholder */}
          <div className="aspect-square bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl mb-6 flex items-center justify-center">
            <Music className="w-24 h-24 text-white/50" />
          </div>

          {/* Song info */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">{song.name}</h1>
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <User className="w-4 h-4" />
              <span>{song.artistName}</span>
            </div>
            {(song.genre || song.mood) && (
              <div className="flex items-center justify-center gap-2 mt-2">
                {song.genre && (
                  <span className="px-2 py-1 bg-purple-600/30 text-purple-300 rounded-full text-xs">
                    {song.genre}
                  </span>
                )}
                {song.mood && (
                  <span className="px-2 py-1 bg-blue-600/30 text-blue-300 rounded-full text-xs">
                    {song.mood}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Player controls */}
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Play button */}
            <div className="flex justify-center">
              <Button
                onClick={togglePlay}
                size="lg"
                className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-500"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-1" />
                )}
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-700 text-center">
            <p className="text-gray-500 text-sm mb-4">
              Create your own music with AI
            </p>
            <Button
              onClick={() => (window.location.href = "/signup")}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
            >
              Try CodedSwitch Free
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
