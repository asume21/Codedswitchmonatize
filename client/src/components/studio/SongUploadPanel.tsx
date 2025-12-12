import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { SimpleFileUploader } from "@/components/SimpleFileUploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTracks } from "@/hooks/useTracks";
import { apiRequest } from "@/lib/queryClient";
import type { Song } from "../../../../shared/schema";

interface SongUploadPanelProps {
  onTranscriptionComplete?: (payload: {
    songId: string;
    songName: string;
    lyrics: string;
  }) => void;
  onSongUploaded?: (song: Song) => void;
}

interface UploadContext {
  name?: string;
  fileSize?: number;
  format?: string;
  mimeType?: string;
}

export function SongUploadPanel({ onTranscriptionComplete, onSongUploaded }: SongUploadPanelProps) {
  const { toast } = useToast();
  const { addTrack } = useTracks();
  const [uploadContext, setUploadContext] = useState<UploadContext | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [creditsDialogOpen, setCreditsDialogOpen] = useState(false);
  const [creditsDialogReason, setCreditsDialogReason] = useState<"auth" | "credits" | null>(null);

  const uploadSongMutation = useMutation({
    mutationFn: async (songData: any) => {
      const response = await apiRequest("POST", "/api/songs/upload", songData);
      if (!response.ok) {
        throw new Error("Failed to save song");
      }
      return response.json() as Promise<Song>;
    },
    onError: (error: any) => {
      const isAuthError = error?.response?.status === 401 || error?.message?.includes("log in");
      toast({
        title: "Upload Failed",
        description: isAuthError
          ? "Please log in to upload songs. Refresh the page and sign in."
          : "Failed to save your song. Please try again.",
        variant: "destructive",
        duration: isAuthError ? 10000 : 5000,
      });
    },
  });

  const transcribeSong = async (song: Song): Promise<string | null> => {
    const songId = song.id.toString();
    setIsTranscribing(true);

    try {
      const audioUrl = song.accessibleUrl || song.originalUrl || (song as any).songURL;
      if (!audioUrl) {
        toast({
          title: "Transcription Failed",
          description: "No audio URL available for this song.",
          variant: "destructive",
        });
        return null;
      }

      const response = await apiRequest("POST", "/api/transcribe", {
        fileUrl: audioUrl,
      });
      const data = await response.json();

      if (data.transcription && data.transcription.text) {
        const text = data.transcription.text as string;
        toast({
          title: "Transcription Complete",
          description: "Lyrics have been transcribed successfully.",
        });

        if (onTranscriptionComplete) {
          onTranscriptionComplete({
            songId,
            songName: song.name || "Untitled Song",
            lyrics: text,
          });
        }

        return text;
      }

      toast({
        title: "Transcription Failed",
        description: "Transcription finished but no text was returned.",
        variant: "destructive",
      });
      return null;
    } catch (error) {
      console.error("Transcription error:", error);

      const message = (error as Error)?.message || "";
      const statusCode = parseInt(message.split(":")[0], 10);

      if (statusCode === 401) {
        setCreditsDialogReason("auth");
        setCreditsDialogOpen(true);
      } else if (statusCode === 402) {
        setCreditsDialogReason("credits");
        setCreditsDialogOpen(true);
      } else {
        toast({
          title: "Transcription Failed",
          description: "Could not transcribe the song. Please try again.",
          variant: "destructive",
        });
      }

      return null;
    } finally {
      setIsTranscribing(false);
    }
  };

  const getUploadParameters = async (file?: File) => {
    const fileName = file?.name || "";
    const format = fileName.split(".").pop()?.toLowerCase() || "";

    const response = await apiRequest("POST", "/api/objects/upload", {
      fileName,
      format,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error", temporary: false }));

      if (response.status === 503 || (errorData as any).temporary) {
        const retryAfter = (errorData as any).retryAfter || 300;
        const minutes = Math.ceil(retryAfter / 60);
        toast({
          title: "Upload Service Temporarily Down",
          description: `The file upload service is temporarily unavailable. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
          variant: "destructive",
          duration: 8000,
        });
        throw new Error("Service temporarily unavailable");
      }

      toast({
        title: "Upload Service Error",
        description: "Unable to connect to upload service. Please refresh the page and try again.",
        variant: "destructive",
      });
      throw new Error((errorData as any).error || "Failed to generate upload URL");
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response:", text.substring(0, 200));
      toast({
        title: "Server Error",
        description: "Server returned an invalid response. The upload service may be down.",
        variant: "destructive",
      });
      throw new Error("Server returned invalid response");
    }

    const data = await response.json();
    if (!data.uploadURL) {
      toast({
        title: "Upload Configuration Error",
        description: "Server did not provide upload URL. Please contact support if this persists.",
        variant: "destructive",
      });
      throw new Error("No upload URL received from server");
    }

    return {
      method: "PUT" as const,
      url: data.uploadURL as string,
    };
  };

  const handleUploadComplete = (result: { url: string; name: string; file: File }) => {
    const songURL = result.url;

    const actualFile = result.file;
    const fileName = result.name || `Uploaded Song ${Date.now()}`;
    const fileExtension = fileName.split(".").pop()?.toLowerCase() || "unknown";
    const fileSize = actualFile.size || 0;
    const mimeType = actualFile.type || "";

    let format = fileExtension;
    if (mimeType.includes("audio/")) {
      format = mimeType.split("/")[1] || fileExtension;
    }

    const fileInfo: UploadContext = {
      name: fileName,
      fileSize,
      format: format === "unknown" ? mimeType || "audio" : format,
      mimeType,
    };

    setUploadContext(fileInfo);

    const uploadWithData = async (duration: number) => {
      const roundedDuration = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0;
      const songData = {
        songURL,
        name: fileInfo.name,
        fileSize: fileInfo.fileSize,
        format: fileInfo.format,
        mimeType: fileInfo.mimeType,
        duration: roundedDuration,
      };

      try {
        const newSong = await uploadSongMutation.mutateAsync(songData);
        onSongUploaded?.(newSong);

        // Register uploaded song as an audio track in the shared track store
        const audioUrl = newSong.accessibleUrl || newSong.originalUrl || (newSong as any).songURL;
        if (audioUrl) {
          addTrack({
            name: newSong.name || "Uploaded Song",
            type: "audio",
            audioUrl,
            source: "song-uploader",
            lengthBars: 4,
            startBar: 0,
          });
        }

        await transcribeSong(newSong);
      } catch (error) {
        console.error("Upload mutation error:", error);
      }
    };

    const file = actualFile as File;
    if (file && file instanceof File) {
      const audioEl = document.createElement("audio");
      const objectURL = URL.createObjectURL(file);

      let durationFound = false;
      const audioTimeout = setTimeout(() => {
        if (!durationFound) {
          URL.revokeObjectURL(objectURL);
          uploadWithData(0);
        }
      }, 8000);

      audioEl.addEventListener("loadedmetadata", () => {
        durationFound = true;
        clearTimeout(audioTimeout);
        const duration = audioEl.duration;
        URL.revokeObjectURL(objectURL);
        uploadWithData(duration);
      });

      audioEl.addEventListener("error", () => {
        durationFound = true;
        clearTimeout(audioTimeout);
        URL.revokeObjectURL(objectURL);
        uploadWithData(0);
      });

      audioEl.src = objectURL;
    } else {
      uploadWithData(0);
    }
  };

  return (
    <>
      <div className="mb-4 border-b border-gray-700 bg-studio-panel px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-200">Upload & Transcribe Song</h3>
          {isTranscribing && (
            <span className="text-xs text-gray-400">Transcribing lyrics…</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <SimpleFileUploader
              onGetUploadParameters={getUploadParameters}
              onComplete={handleUploadComplete}
            >
              Upload Song
            </SimpleFileUploader>
          </div>
          {uploadContext && (
            <div className="text-xs text-gray-400 whitespace-nowrap">
              <div>{uploadContext.name}</div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={creditsDialogOpen} onOpenChange={setCreditsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {creditsDialogReason === "auth" ? "Sign in required" : "Not enough credits"}
            </DialogTitle>
            <DialogDescription>
              {creditsDialogReason === "auth"
                ? "You need to be logged in to use Song Doctor transcription. Please sign in, then try again."
                : "You don't have enough credits to transcribe this song. Add credits or upgrade your plan to continue."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreditsDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              className="bg-studio-accent hover:bg-blue-500"
              onClick={() => {
                setCreditsDialogOpen(false);
                window.location.href = creditsDialogReason === "auth" ? "/login" : "/billing";
              }}
            >
              {creditsDialogReason === "auth" ? "Go to Login" : "Manage Plan & Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
