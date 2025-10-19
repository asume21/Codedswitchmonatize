import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import XHRUpload from "@uppy/xhr-upload";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

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
  
  const [uppy] = useState(() => {
    try {
      const uppyInstance = new Uppy({
        restrictions: {
          maxNumberOfFiles,
          maxFileSize,
          allowedFileTypes: ['audio/*', '.mp3', '.wav', '.m4a', '.ogg', '.flac'],
        },
        autoProceed: false,
      })
        .use(XHRUpload, {
          endpoint: 'dummy', // Will be replaced per-file
          method: 'PUT',
          fieldName: 'file',
          getResponseData: (responseText: string) => {
            try {
              return JSON.parse(responseText);
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
            uppy.emit('upload-error', file, error);
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

  // Cleanup Uppy instance on unmount
  useEffect(() => {
    return () => {
      try {
        // Only cleanup if uppy instance is valid and has methods
        if (uppy && typeof uppy.cancelAll === 'function') {
          uppy.cancelAll();
        }
        if (uppy && typeof uppy.close === 'function') {
          uppy.close();
        }
      } catch (error) {
        // Silently handle cleanup errors to prevent console spam
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

      {!initError && uppy && showModal && (
        <DashboardModal
          uppy={uppy}
          open={showModal}
          onRequestClose={() => setShowModal(false)}
          proudlyDisplayPoweredByUppy={false}
          note="Upload audio files (MP3, WAV, M4A, OGG, FLAC) up to 50MB"
        />
      )}
    </div>
  );
}