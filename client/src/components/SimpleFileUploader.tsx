import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Progress } from "@/components/ui/progress";

interface SimpleFileUploaderProps {
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: { url: string; name: string }) => void;
  maxFileSize?: number;
  accept?: string;
  buttonClassName?: string;
  children: React.ReactNode;
}

export function SimpleFileUploader({
  onGetUploadParameters,
  onComplete,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  accept = "audio/*,video/*,.mp3,.m4a,.wav,.ogg,.mov,.mp4",
  buttonClassName = "",
  children,
}: SimpleFileUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize) {
      setError(`File too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    console.log('🎯 handleUpload called!');
    console.log('📁 Selected file:', selectedFile);
    
    if (!selectedFile) {
      console.error('❌ No file selected!');
      return;
    }

    try {
      console.log('✅ Starting upload process...');
      setUploading(true);
      setProgress(0);
      setError(null);

      console.log('Getting upload parameters...');
      const params = await onGetUploadParameters().catch(err => {
        console.error('Failed to get upload parameters:', err);
        throw new Error(`Upload setup failed: ${err.message}`);
      });

      console.log('Uploading file:', selectedFile.name);
      console.log('Upload URL:', params.url);
      console.log('Upload method:', params.method);
      console.log('File size:', selectedFile.size, 'bytes');
      console.log('File type:', selectedFile.type);
      
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        console.log('📊 Upload progress:', e.loaded, '/', e.total);
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          console.log('Progress:', percentComplete.toFixed(1) + '%');
          setProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        console.log('✅ XHR load event - Status:', xhr.status, xhr.statusText);
        console.log('Response:', xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('Upload successful!');
          onComplete?.({
            url: params.url.split('?')[0], // Remove query params
            name: selectedFile.name,
          });
          setShowModal(false);
          setSelectedFile(null);
          setProgress(0);
        } else {
          console.error('❌ Upload failed with status:', xhr.status);
          console.error('Response text:', xhr.responseText);
          setError(`Upload failed: ${xhr.status} ${xhr.statusText}`);
        }
        setUploading(false);
      });

      xhr.addEventListener('error', (e) => {
        console.error('❌ XHR error event:', e);
        console.error('XHR status:', xhr.status);
        console.error('XHR readyState:', xhr.readyState);
        setError('Upload failed. Please try again.');
        setUploading(false);
      });

      xhr.addEventListener('abort', () => {
        console.error('❌ Upload aborted');
        setError('Upload was cancelled');
        setUploading(false);
      });

      xhr.addEventListener('timeout', () => {
        console.error('❌ Upload timeout');
        setError('Upload timed out');
        setUploading(false);
      });

      xhr.open(params.method, params.url);
      xhr.withCredentials = true; // Enable cookies/auth for cross-origin requests
      xhr.timeout = 120000; // 2 minute timeout
      xhr.setRequestHeader('Content-Type', selectedFile.type || 'application/octet-stream');
      console.log('🚀 Sending XHR request...');
      xhr.send(selectedFile);
      console.log('📤 XHR request sent');

    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={() => {
          console.log('🔘 Upload button clicked - opening modal');
          setShowModal(true);
        }}
        className={buttonClassName}
      >
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <VisuallyHidden>
            <DialogTitle>Upload Song</DialogTitle>
            <DialogDescription>Upload audio files to your library</DialogDescription>
          </VisuallyHidden>
          
          <div className="p-6 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Upload Song</h2>
              <p className="text-gray-400 text-sm">
                Select an audio file to upload (MP3, WAV, M4A, OGG - max {Math.round(maxFileSize / 1024 / 1024)}MB)
              </p>
            </div>

            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                {selectedFile ? (
                  <div>
                    <i className="fas fa-file-audio text-4xl text-blue-500 mb-4"></i>
                    <p className="text-lg font-semibold">{selectedFile.name}</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      Choose Different File
                    </Button>
                  </div>
                ) : (
                  <div>
                    <i className="fas fa-cloud-upload-alt text-6xl text-gray-600 mb-4"></i>
                    <p className="text-lg font-semibold">Click to browse</p>
                    <p className="text-sm text-gray-400 mt-2">or drag and drop your file here</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-500 text-sm">
                  {error}
                </div>
              )}

              {uploading && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-center text-gray-400">
                    Uploading... {Math.round(progress)}%
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500"
                >
                  {uploading ? 'Uploading...' : 'Upload Song'}
                </Button>
                <Button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedFile(null);
                    setError(null);
                    setProgress(0);
                  }}
                  variant="outline"
                  disabled={uploading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
