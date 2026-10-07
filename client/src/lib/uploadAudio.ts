/**
 * Upload an in-browser audio Blob (a recorded take, a bounce) and return a
 * permanent URL the studio can store on a track.
 *
 * Takes used to be kept as `blob:` URLs, which only live as long as the tab —
 * a saved project reopened later had silent audio tracks (product review M4/K7).
 * Same two-step flow as the Song Uploader: ask /api/objects/upload for a key,
 * PUT the bytes there; the same path then serves the file (GET).
 */
import { apiRequest } from '@/lib/queryClient';

const EXT_BY_TYPE: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
};

export async function uploadAudioBlob(blob: Blob, baseName: string): Promise<string> {
  const mime = (blob.type || '').split(';')[0].trim().toLowerCase();
  const ext = EXT_BY_TYPE[mime] ?? 'webm';
  const safeName = baseName.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60) || 'take';

  const paramsRes = await apiRequest('POST', '/api/objects/upload', {
    fileName: `${safeName}.${ext}`,
    format: ext,
  });
  const { uploadURL } = (await paramsRes.json()) as { uploadURL?: string };
  if (!uploadURL) throw new Error('Upload URL missing from server response');

  const headers: Record<string, string> = { 'Content-Type': mime || 'application/octet-stream' };
  const token = localStorage.getItem('authToken');
  if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

  const put = await fetch(uploadURL, { method: 'PUT', body: blob, headers, credentials: 'include' });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return uploadURL;
}

/** Resolve a `blob:` URL to permanent storage; other URLs pass through. */
export async function persistAudioUrl(url: string, baseName: string): Promise<string> {
  if (!url.startsWith('blob:')) return url;
  const blob = await (await fetch(url)).blob();
  return uploadAudioBlob(blob, baseName);
}
