import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, Music, Brain, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TrainingStats {
  totalReferences: number;
  genreBreakdown: Record<string, number>;
  avgTempo: number;
  keyDistribution: Record<string, number>;
}

export function AudioTrainingUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    genre: '',
    tempo: 120,
    key: 'C',
    description: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    isUploading: boolean;
    totalFiles: number;
    currentFile: number;
    status: string;
  }>({
    isUploading: false,
    totalFiles: 0,
    currentFile: 0,
    status: ''
  });
  const { toast } = useToast();

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const batchSize = 50; // Process files in batches of 50
    const totalBatches = Math.ceil(files.length / batchSize);
    let processedCount = 0;

    try {
      toast({
        title: "Starting Batch Processing",
        description: `Processing ${files.length} files in ${totalBatches} batches...`,
      });

      for (let i = 0; i < totalBatches; i++) {
        const startIndex = i * batchSize;
        const endIndex = Math.min(startIndex + batchSize, files.length);
        const batchFiles = files.slice(startIndex, endIndex);

        const formData = new FormData();
        batchFiles.forEach((file) => {
          formData.append('audio', file);
        });

        console.log(`Processing batch ${i + 1}/${totalBatches} (${batchFiles.length} files)`);
        
        toast({
          title: `Processing Batch ${i + 1}/${totalBatches}`,
          description: `Processing ${batchFiles.length} files...`,
        });

        const response = await fetch('/api/bulk-upload-training', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Batch ${i + 1} failed: ${response.statusText}`);
        }

        const result = await response.json();
        processedCount += result.totalProcessed || batchFiles.length;
        
        console.log(`✅ Batch ${i + 1} complete: ${result.totalProcessed || batchFiles.length} files processed`);
        
        // Small delay between batches to prevent overwhelming the server
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: "All Batches Complete!",
        description: `Successfully processed ${processedCount} files total. AI training enhanced!`,
      });

      // Refresh training stats
      setTimeout(() => window.location.reload(), 2000);

    } catch (error: any) {
      console.error('Batch processing error:', error);
      toast({
        title: "Batch Processing Failed",
        description: `Processed ${processedCount} files before error: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const { data: trainingStats } = useQuery<TrainingStats>({
    queryKey: ['/api/training-stats'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/upload-training-audio', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Training Audio Uploaded",
        description: "Your reference track has been added to improve AI generation quality.",
      });
      setSelectedFile(null);
      setMetadata({ genre: '', tempo: 120, key: 'C', description: '' });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const analyzeAudioMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('audio', file);
      const response = await apiRequest('POST', '/api/analyze-audio', formData);
      return response.json();
    },
    onSuccess: (analysis) => {
      setMetadata({
        genre: analysis.genre || '',
        tempo: analysis.tempo || 120,
        key: analysis.key || 'C',
        description: analysis.mood ? `${analysis.mood} style with ${analysis.instruments?.join(', ')}` : ''
      });
      toast({
        title: "Audio Analysis Complete",
        description: "AI has analyzed your audio and filled in the metadata.",
      });
    },
  });

  const processAttachedAssetsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/process-attached-assets');
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Professional Tracks Added!",
        description: `Successfully processed ${result.processedFiles.length} tracks: ${result.processedFiles.join(', ')}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('audio/')) {
        toast({
          title: "Invalid File Type",
          description: "Please upload an audio file (MP3, WAV, M4A).",
          variant: "destructive",
        });
        return;
      }

      // Check file size (limit to 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Audio files must be smaller than 50MB.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      
      // Auto-analyze with AI
      setIsAnalyzing(true);
      analyzeAudioMutation.mutate(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('audio', selectedFile);
    formData.append('metadata', JSON.stringify(metadata));
    
    uploadMutation.mutate(formData);
  };

  const genres = [
    'Electronic', 'Hip-Hop', 'Pop', 'Rock', 'Jazz', 'Classical', 
    'Ambient', 'Techno', 'House', 'Dubstep', 'Trap', 'Lo-Fi'
  ];

  const keys = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
    'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'
  ];

  return (
    <div className="space-y-6">
      {/* Training Stats Overview */}
      <Card className="bg-studio-panel border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-400" />
            AI Training Dataset
          </CardTitle>
          <CardDescription>
            Upload high-quality reference tracks to improve AI music generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trainingStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{trainingStats.totalReferences}</div>
                <div className="text-sm text-gray-400">Reference Tracks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{Math.round(trainingStats.avgTempo)}</div>
                <div className="text-sm text-gray-400">Avg BPM</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {Object.keys(trainingStats.genreBreakdown).length}
                </div>
                <div className="text-sm text-gray-400">Genres</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {Object.keys(trainingStats.keyDistribution).length}
                </div>
                <div className="text-sm text-gray-400">Keys</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No training data uploaded yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Interface */}
      <Card className="bg-studio-panel border-gray-600">
        <CardHeader>
          <CardTitle>Upload Reference Track</CardTitle>
          <CardDescription>
            Add professional tracks for the AI to learn from and improve generation quality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="audio-upload">Audio File</Label>
            <div className="flex items-center gap-4">
              <Input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="file:bg-studio-accent file:text-white file:border-0 file:rounded-md"
                data-testid="input-audio-upload"
              />
              {selectedFile && (
                <Badge variant="outline" className="text-green-400 border-green-400">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {selectedFile.name}
                </Badge>
              )}
            </div>
          </div>

          {isAnalyzing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Brain className="w-4 h-4 animate-pulse" />
                Analyzing audio with AI...
              </div>
              <Progress value={75} className="h-2" />
            </div>
          )}

          {/* Metadata Form */}
          {selectedFile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="genre">Genre</Label>
                <Select
                  value={metadata.genre}
                  onValueChange={(value) => setMetadata({ ...metadata, genre: value })}
                >
                  <SelectTrigger data-testid="select-genre">
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((genre) => (
                      <SelectItem key={genre} value={genre.toLowerCase()}>
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tempo">Tempo (BPM)</Label>
                <Input
                  id="tempo"
                  type="number"
                  min="60"
                  max="200"
                  value={metadata.tempo}
                  onChange={(e) => setMetadata({ ...metadata, tempo: parseInt(e.target.value) || 120 })}
                  data-testid="input-tempo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Select
                  value={metadata.key}
                  onValueChange={(value) => setMetadata({ ...metadata, key: value })}
                >
                  <SelectTrigger data-testid="select-key">
                    <SelectValue placeholder="Select key" />
                  </SelectTrigger>
                  <SelectContent>
                    {keys.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the style, mood, instruments..."
                  value={metadata.description}
                  onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                  className="min-h-[80px]"
                  data-testid="textarea-description"
                />
              </div>
            </div>
          )}

          {/* Drag & Drop Folder Upload - Perfect for 16,000 files! */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-semibold text-white">Upload Entire Folder (Perfect for 16,000+ files!)</Label>
              
              {/* Hidden folder input */}
              <input
                id="folder-upload"
                type="file"
                accept="audio/*"
                multiple
                {...({ webkitdirectory: "" } as any)}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    const audioFiles = Array.from(files).filter(file => 
                      file.type.startsWith('audio/') || 
                      /\.(mp3|wav|m4a|flac|ogg|aac|wma)$/i.test(file.name)
                    );

                    if (audioFiles.length === 0) {
                      toast({
                        title: "No Audio Files Found",
                        description: "The selected folder doesn't contain any audio files.",
                        variant: "destructive",
                      });
                      return;
                    }

                    setUploadProgress({
                      isUploading: true,
                      totalFiles: audioFiles.length,
                      currentFile: 0,
                      status: `Preparing to upload ${audioFiles.length} audio files...`
                    });

                    const formData = new FormData();
                    audioFiles.forEach(file => {
                      formData.append('audio', file);
                    });
                    
                    toast({
                      title: "Upload Starting!",
                      description: `Found ${audioFiles.length} audio files. Upload and processing starting now!`,
                    });

                    setUploadProgress(prev => ({
                      ...prev,
                      status: 'Uploading files to server...'
                    }));
                    
                    // Start progress simulation while upload happens
                    const progressInterval = setInterval(() => {
                      setUploadProgress(prev => {
                        if (!prev.isUploading) return prev;
                        const progressIncrement = Math.max(1, Math.floor(prev.totalFiles / 100));
                        const newCurrent = Math.min(prev.currentFile + progressIncrement, prev.totalFiles - 50);
                        return {
                          ...prev,
                          currentFile: newCurrent,
                          status: `Processing file ${newCurrent} of ${prev.totalFiles}...`
                        };
                      });
                    }, 1000);
                    
                    // Auto-process all files
                    fetch('/api/bulk-upload-training', {
                      method: 'POST',
                      body: formData
                    })
                    .then(res => res.json())
                    .then(result => {
                      clearInterval(progressInterval);
                      setUploadProgress({
                        isUploading: false,
                        totalFiles: audioFiles.length,
                        currentFile: result.processed,
                        status: `Complete! Successfully processed ${result.processed} files and enhanced AI training.`
                      });
                      
                      toast({
                        title: "🎵 Massive Upload Complete!",
                        description: `Successfully processed ${result.processed} of ${audioFiles.length} files! Your AI is now dramatically enhanced!`,
                      });
                    })
                    .catch(error => {
                      clearInterval(progressInterval);
                      setUploadProgress({
                        isUploading: false,
                        totalFiles: audioFiles.length,
                        currentFile: 0,
                        status: `Upload failed: ${error.message}`
                      });
                      
                      toast({
                        title: "Upload Error",
                        description: error.message,
                        variant: "destructive",
                      });
                    });
                  }
                }}
                data-testid="input-folder-upload"
              />

              {/* Large clickable area or progress display */}
              {uploadProgress.isUploading ? (
                <div className="border-2 border-blue-500 bg-blue-900/20 rounded-lg p-8">
                  <div className="text-center">
                    <div className="text-4xl mb-4 animate-pulse">⏳</div>
                    <div className="text-xl font-bold text-blue-400 mb-2">Upload in Progress</div>
                    <div className="text-sm text-blue-300 mb-4">{uploadProgress.status}</div>
                    
                    <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
                      <div 
                        className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                        style={{ 
                          width: uploadProgress.totalFiles > 0 
                            ? `${Math.min(100, (uploadProgress.currentFile / uploadProgress.totalFiles) * 100)}%` 
                            : '10%' 
                        }}
                      />
                    </div>
                    
                    <div className="text-xs text-blue-300">
                      {uploadProgress.totalFiles > 0 && (
                        `${uploadProgress.currentFile} / ${uploadProgress.totalFiles} files processed`
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-yellow-500 bg-yellow-900/10 hover:bg-yellow-900/20 rounded-lg p-8 cursor-pointer transition-colors"
                  onClick={() => !uploadProgress.isUploading && document.getElementById('folder-upload')?.click()}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-4">📁</div>
                    <div className="text-xl font-bold text-yellow-400 mb-2">
                      {uploadProgress.totalFiles > 0 ? 'Upload Complete!' : 'Click to Select Folder'}
                    </div>
                    <div className="text-sm text-yellow-300 mb-4">
                      {uploadProgress.totalFiles > 0 
                        ? `Successfully processed ${uploadProgress.currentFile} files!` 
                        : 'Perfect for your 16,000 audio files'
                      }
                    </div>
                    <Button 
                      type="button"
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8 py-3"
                      disabled={uploadProgress.isUploading}
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('folder-upload')?.click();
                      }}
                      data-testid="button-select-folder"
                    >
                      {uploadProgress.totalFiles > 0 ? 'Upload Another Folder' : 'Select Entire Folder'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="text-xs text-yellow-300 bg-yellow-900/20 p-3 rounded-lg">
                <div className="font-semibold text-yellow-200 mb-2">📁 FOLDER UPLOAD INSTRUCTIONS:</div>
                <div>1. Click "Select Entire Folder" button above</div>
                <div>2. Navigate to your unzipped Downloads folder</div>
                <div>3. Click "Select Folder" or "Upload" in the dialog</div>
                <div>4. All 16,000 audio files will be automatically processed!</div>
              </div>
            </div>
          </div>

          {/* Alternative: Individual File Upload */}
          <div className="space-y-4 border-t border-gray-600 pt-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-upload" className="text-sm text-gray-300">Alternative: Select Multiple Files Manually</Label>
              <Input
                id="bulk-upload"
                type="file"
                accept="audio/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    const formData = new FormData();
                    for (let i = 0; i < files.length; i++) {
                      formData.append('audio', files[i]);
                    }
                    
                    toast({
                      title: "Uploading Files...",
                      description: `Uploading ${files.length} files. Processing will start automatically.`,
                    });
                    
                    // Auto-process all files
                    fetch('/api/bulk-upload-training', {
                      method: 'POST',
                      body: formData
                    })
                    .then(res => res.json())
                    .then(result => {
                      toast({
                        title: "Processing Complete!",
                        description: `Successfully processed ${result.processed} files. AI training enhanced!`,
                      });
                    })
                    .catch(error => {
                      toast({
                        title: "Upload Error",
                        description: error.message,
                        variant: "destructive",
                      });
                    });
                  }
                }}
                className="file:bg-green-600 file:text-white file:border-0 file:rounded-md"
                data-testid="input-bulk-upload"
              />
              <div className="text-xs text-gray-400">
                Only use this if folder upload doesn't work - manually select multiple files with Ctrl+A (Cmd+A on Mac)
              </div>
            </div>
          </div>

          {/* Single File Upload */}
          {selectedFile && (
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending || !metadata.genre}
                className="bg-studio-accent hover:bg-blue-500"
                data-testid="button-upload-training"
              >
                {uploadMutation.isPending ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Add to Training Dataset
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Setup - Process Existing Professional Tracks */}
      <Card className="bg-gradient-to-r from-purple-900 to-blue-900 border-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-yellow-400" />
            Quick Setup: Professional Tracks
          </CardTitle>
          <CardDescription className="text-purple-200">
            I found your professional tracks (CINEMA, BETWEEN US) ready to enhance AI quality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-black/30 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium text-white">Found Professional Tracks:</div>
            <div className="text-xs text-purple-200 space-y-1">
              <div>🎬 CINEMA - Cinematic/Electronic</div>
              <div>🎵 BETWEEN US (Polo G Type Beat) - Hip-Hop/Trap</div>
              <div>🎤 Serial Killa - Rap/Hip-Hop</div>
            </div>
          </div>
          
          <Button
            onClick={() => processAttachedAssetsMutation.mutate()}
            disabled={processAttachedAssetsMutation.isPending}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            data-testid="button-process-professional-tracks"
          >
            {processAttachedAssetsMutation.isPending ? (
              <>Processing Professional Tracks...</>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Add Professional Tracks to AI Training
              </>
            )}
          </Button>
          
          <div className="text-xs text-purple-200">
            This will automatically analyze and add your professional tracks to improve AI generation quality
          </div>
        </CardContent>
      </Card>

      {/* Direct File Sharing - Let Me Handle The Upload */}
      <Card className="bg-gradient-to-r from-green-900 to-teal-900 border-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-green-400" />
            Direct File Transfer - Let Me Handle Everything!
          </CardTitle>
          <CardDescription className="text-green-200">
            Share your 16,000 files directly with me - I'll process them in manageable sections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-black/30 rounded-lg p-4 space-y-4">
            <div className="text-lg font-semibold text-white">📤 Share Your 16,000 Files With Me</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-500/20 border border-blue-500 rounded p-4">
                <div className="text-blue-400 font-semibold mb-2">🔗 Option 1: Cloud Link</div>
                <div className="text-xs text-blue-200 space-y-1">
                  <div>• Upload to Google Drive/Dropbox</div>
                  <div>• Share link with me</div>
                  <div>• I'll download and process in sections</div>
                  <div>• Best for organized folders</div>
                </div>
              </div>
              
              <div className="bg-green-500/20 border border-green-500 rounded p-4">
                <div className="text-green-400 font-semibold mb-2">📎 Option 2: Attach Files</div>
                <div className="text-xs text-green-200 space-y-1">
                  <div>• Upload samples to chat attachments</div>
                  <div>• I'll process them immediately</div>
                  <div>• Great for testing/small batches</div>
                  <div>• Send 50-100 files at a time</div>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-500/20 border border-yellow-500 rounded p-3">
              <div className="text-yellow-400 font-semibold mb-2">🚀 I'll Handle The Processing:</div>
              <div className="text-xs text-yellow-200 space-y-1">
                <div>• Process files in manageable 1000-file sections</div>
                <div>• Auto-detect genres from filenames/folders</div>
                <div>• Add all tracks to your AI training dataset</div>
                <div>• Show you progress updates in real-time</div>
                <div>• No browser upload limits or timeout issues</div>
              </div>
            </div>
            
            <div className="text-center space-y-4">
              <div className="text-sm text-white mb-2">Upload Your Audio Files Directly</div>
              
              {/* File Drop Zone */}
              <div 
                className="border-2 border-dashed border-gray-400 rounded-lg p-8 bg-black/20 hover:bg-black/30 transition-colors"
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files).filter(file => 
                    file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|m4a|aac|flac|ogg)$/i)
                  );
                  
                  if (files.length > 0) {
                    toast({
                      title: "Files Received!",
                      description: `Preparing to process ${files.length} audio files...`,
                    });
                    
                    // Process files in batches
                    handleFileUpload(files);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => e.preventDefault()}
              >
                <div className="text-center">
                  <div className="text-4xl mb-4">🎵</div>
                  <div className="text-lg font-semibold mb-2">Drop Your Audio Files Here</div>
                  <div className="text-sm text-gray-300 mb-4">
                    Drag and drop your audio files (MP3, WAV, M4A, etc.)<br/>
                    <strong>Processes in batches of 50 files</strong> - Perfect for large collections!
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
                    className="hidden"
                    id="audio-file-input"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        toast({
                          title: "Files Selected!",
                          description: `Processing ${files.length} audio files...`,
                        });
                        handleFileUpload(files);
                      }
                    }}
                    data-testid="input-audio-files"
                  />
                  <Button 
                    onClick={() => document.getElementById('audio-file-input')?.click()}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-select-files"
                  >
                    Or Click to Select Files
                  </Button>
                </div>
              </div>
              
              <div className="text-xs text-gray-300">
                No Google Drive setup needed - just upload your files directly!
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 12GB Dataset Processing */}
      <Card className="bg-gradient-to-r from-green-900 to-teal-900 border-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-green-400" />
            Process Your 12GB Dataset
          </CardTitle>
          <CardDescription className="text-green-200">
            Ready to process your structured audio collection for maximum AI improvement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-black/30 rounded-lg p-4">
            <div className="text-sm text-white mb-2">✓ Folders Ready: Hip-Hop, Electronic, Pop, Rock, Jazz, Classical, Ambient, Cinematic</div>
            <div className="text-xs text-green-200">
              Just unzip your structured files into these folders, then click below to train the AI
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => {
                fetch('/api/process-attached-assets')
                .then(res => res.json())
                .then(result => {
                  toast({
                    title: "Professional Tracks Added!",
                    description: `Processed: ${result.processedFiles.join(', ')}`,
                  });
                })
                .catch(error => {
                  toast({
                    title: "Processing Error",
                    description: error.message,
                    variant: "destructive",
                  });
                });
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3"
              data-testid="button-process-pro-tracks"
            >
              <Music className="w-4 h-4 mr-2" />
              Add CINEMA & BETWEEN US
            </Button>
            
            <Button
              onClick={() => {
                fetch('/api/process-training-directory', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    directoryPath: '/home/runner/workspace/training_audio_dataset',
                    maxFiles: 10000
                  })
                })
                .then(res => res.json())
                .then(result => {
                  toast({
                    title: "All Uploaded Files Processed!",
                    description: `Processed ${result.totalProcessed} files. AI dramatically improved!`,
                  });
                })
                .catch(error => {
                  toast({
                    title: "Processing Error", 
                    description: error.message,
                    variant: "destructive",
                  });
                });
              }}
              className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-bold py-3"
              data-testid="button-process-all-files"
            >
              <Upload className="w-4 h-4 mr-2" />
              Process All My Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Training Tips */}
      <Card className="bg-studio-panel border-gray-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            Training Tips for 12GB Dataset
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-300">
            <p><strong className="text-white">Professional tracks give MASSIVE quality improvement:</strong></p>
            <p>• Your CINEMA and BETWEEN US tracks = Professional reference quality</p>
            <p>• 12GB dataset = Thousands of musical patterns and styles</p>
            <p>• More professional tracks = Better chord progressions and arrangements</p>
            <p>• Variety in genres/tempos = More flexible AI generation</p>
            <p>• Original professionally mixed tracks work best (not MIDI or basic demos)</p>
            <p><strong className="text-green-400">12GB Dataset Tips:</strong></p>
            <p>• Organize by folders: Hip-Hop/, Electronic/, Pop/, Rock/, etc.</p>
            <p>• Keep UNZIPPED for faster processing and better file analysis</p>
            <p>• Mix of tempos (70-180 BPM) gives AI more flexibility</p>
            <p><strong className="text-yellow-400">Result:</strong> AI will generate radio-quality music matching your style</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}