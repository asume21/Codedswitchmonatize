import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import XHRUpload from "@uppy/xhr-upload";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 * 
 * The component uses Uppy under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded
 *   (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onGetUploadParameters - Function to get upload parameters (method and URL).
 *   Typically used to fetch a presigned URL from the backend server for direct-to-S3
 *   uploads.
 * @param props.onComplete - Callback function called when upload is complete. Typically
 *   used to make post-upload API calls to update server state and set object ACL
 *   policies.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const dashboardInstanceRef = useRef<any>(null);
  
  const [uppy] = useState(() => {
    try {
      const uppyInstance = new Uppy({
        restrictions: {
          maxNumberOfFiles,
          maxFileSize,
          // Support all audio formats including iPhone/iOS formats
          allowedFileTypes: [
            'audio/*', 
            'video/*',  // iOS voice memos sometimes saved as video
            '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac',
            '.mp4', '.mov',  // iOS camera roll videos with audio
            '.caf',  // Core Audio Format (iOS)
            '.aiff', '.aif',  // Audio Interchange File Format
            '.wma', '.webm'  // Additional formats
          ],
        },
        autoProceed: false,
        // Mobile-friendly settings
        allowMultipleUploadBatches: false,
      })
        .use(XHRUpload, {
          endpoint: 'dummy', // Will be replaced per-file
          method: 'PUT',
          fieldName: 'file',
          getResponseData: (xhr: XMLHttpRequest) => {
            try {
              return JSON.parse(xhr.responseText);
            } catch {
              return { success: true };
            }
          },
        })
        .on('file-added', async (file) => {
          try {
            // Get upload URL for this specific file
            const params = await onGetUploadParameters();
            // @ts-ignore - Uppy's internal API
            uppy.setFileState(file.id, {
              xhrUpload: {
                endpoint: params.url,
                method: params.method,
              }
            });
            console.log(`📤 Upload URL set for ${file.name}:`, params.url);
          } catch (error) {
            console.error('Failed to get upload URL:', error);
            const errorObj = error instanceof Error ? error : new Error('Upload failed');
            uppy.emit('upload-error', file, errorObj);
          }
        })
        .on("complete", (result) => {
          console.log('✅ Upload complete:', result);
          onComplete?.(result);
          setShowModal(false);
        })
        .on("error", (error) => {
          console.error('❌ Uppy error:', error);
          setInitError(error?.message || 'Upload failed');
        });
      
      console.log('✅ Uppy initialized successfully with XHR upload');
      return uppyInstance;
    } catch (error) {
      console.error('❌ Uppy initialization failed:', error);
      setInitError(error instanceof Error ? error.message : 'Failed to initialize uploader');
      // Return a dummy Uppy instance to prevent crashes
      return new Uppy();
    }
  });

  // Mount Dashboard when modal opens
  useEffect(() => {
    if (showModal && dashboardRef.current && uppy) {
      try {
        console.log('📦 Attempting to mount Uppy Dashboard...');
        
        // Remove existing Dashboard plugin if it exists
        try {
          const existingDashboard = uppy.getPlugin('Dashboard');
          if (existingDashboard) {
            console.log('Removing existing Dashboard plugin');
            uppy.removePlugin(existingDashboard);
          }
        } catch (e) {
          // Plugin doesn't exist, that's fine
        }

        const dashboard = uppy.use(Dashboard, {
          inline: true,
          target: dashboardRef.current,
          proudlyDisplayPoweredByUppy: false,
          note: '📱 Drag & drop your audio file here or click to browse (MP3, M4A, WAV, OGG up to 50MB)',
          width: '100%',
          height: 450,
          showProgressDetails: true,
          hideUploadButton: false,
          hideCancelButton: false,
          hideRetryButton: false,
          showRemoveButtonAfterComplete: true,
        });
        dashboardInstanceRef.current = dashboard;
        console.log('✅ Dashboard mounted successfully!');
      } catch (error) {
        console.error('❌ Dashboard mount error:', error);
      }
    }
  }, [showModal, uppy]);

  // Cleanup Uppy instance on unmount
  useEffect(() => {
    return () => {
      try {
        // Cleanup dashboard plugin
        if (dashboardInstanceRef.current && uppy) {
          uppy.removePlugin(dashboardInstanceRef.current);
          dashboardInstanceRef.current = null;
        }
        // Cancel all uploads
        if (uppy && typeof uppy.cancelAll === 'function') {
          uppy.cancelAll();
        }
      } catch (error) {
        console.debug('Uppy cleanup:', error instanceof Error ? error.message : 'cleanup completed');
      }
    };
  }, [uppy]);

  return (
    <div>
      <Button 
        onClick={() => {
          if (initError) {
            console.error('Cannot open uploader due to init error:', initError);
            return;
          }
          console.log('Opening uploader modal');
          setShowModal(true);
        }} 
        className={buttonClassName}
        disabled={!!initError}
      >
        {children}
      </Button>

      {initError && (
        <p className="text-xs text-red-500 mt-1">
          Upload unavailable: {initError}
        </p>
      )}

      {!initError && showModal && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <VisuallyHidden>
              <DialogTitle>Upload Song</DialogTitle>
            </VisuallyHidden>
            <div className="w-full h-full overflow-auto">
              <div ref={dashboardRef} className="uppy-dashboard-container w-full" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}