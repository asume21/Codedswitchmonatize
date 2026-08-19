/**
 * Security Utilities for CodedSwitch
 * Handles path sanitization, input validation, and XSS prevention
 */

import path from 'path';
import fs from 'fs';
import { resolveLocalAudioPath } from '../services/audioPathResolver';

/**
 * Sanitize a file path to prevent path traversal attacks
 * @param userInput - The user-provided path segment
 * @param baseDir - The base directory that paths must stay within
 * @returns Sanitized path or null if invalid
 */
export function sanitizePath(userInput: string, baseDir: string): string | null {
  if (!userInput || typeof userInput !== 'string') {
    return null;
  }

  // Remove null bytes and other dangerous characters
  const cleaned = userInput
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[<>:"|?*]/g, '') // Remove Windows-invalid chars
    .trim();

  // Normalize and remove path traversal attempts
  const normalized = path.normalize(cleaned).replace(/^(\.\.(\/|\\|$))+/, '');
  
  // Resolve the full path
  const fullPath = path.resolve(baseDir, normalized);
  
  // Ensure the resolved path is within the base directory
  const resolvedBase = path.resolve(baseDir);
  if (!fullPath.startsWith(resolvedBase + path.sep) && fullPath !== resolvedBase) {
    return null;
  }

  return fullPath;
}

/**
 * Validate and sanitize an object key for storage
 * @param objectKey - The object key to validate
 * @returns Sanitized key or null if invalid
 */
export function sanitizeObjectKey(objectKey: string): string | null {
  if (!objectKey || typeof objectKey !== 'string') {
    return null;
  }

  // Decode URI components
  let decoded: string;
  try {
    decoded = decodeURIComponent(objectKey);
  } catch {
    return null;
  }

  // Remove dangerous patterns
  const sanitized = decoded
    .replace(/\0/g, '') // Null bytes
    .replace(/\.\./g, '') // Path traversal
    .replace(/[<>:"|?*]/g, '') // Invalid chars
    .replace(/^\/+/, '') // Leading slashes
    .trim();

  // Validate the result
  if (!sanitized || sanitized.length === 0 || sanitized.length > 500) {
    return null;
  }

  // Only allow alphanumeric, dash, underscore, dot, and forward slash
  if (!/^[a-zA-Z0-9\-_./]+$/.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Sanitize HTML to prevent XSS attacks
 * @param input - The input string to sanitize
 * @returns Sanitized string safe for HTML output
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize SQL-like input (for search queries, etc.)
 * Note: Always use parameterized queries for actual SQL
 * @param input - Input to sanitize
 * @returns Sanitized string
 */
export function sanitizeSearchInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove SQL injection patterns
  return input
    .replace(/['";\\]/g, '') // Remove quotes and backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comment start
    .replace(/\*\//g, '') // Remove block comment end
    .trim()
    .slice(0, 200); // Limit length
}

/**
 * Validate and sanitize a UUID
 * @param uuid - UUID to validate
 * @returns true if valid UUID format
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Rate limiting helper - tracks request counts
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 100, 
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const record = requestCounts.get(identifier);

  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Clean up old rate limit records periodically
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

/**
 * Resolve an audio file path from objectKey or fileUrl, with path traversal protection.
 * Returns the resolved, validated absolute path or null if invalid.
 * @param params - objectKey and/or fileUrl from the request body
 * @param baseDir - The base directory files must reside within (e.g. LOCAL_OBJECTS_DIR)
 */
export function resolveAudioPath(
  params: { objectKey?: string; fileUrl?: string },
  baseDir: string
): string | null {
  const { objectKey, fileUrl } = params;

  // This knew exactly ONE url form: /api/internal/uploads/. It is the resolver
  // behind five routes — create voice, voice convert, duet, extract pitch and
  // pitch correct — and a song uploaded through the Song Uploader has a
  // /api/songs/converted/ url and no other. So all five answered "Invalid or
  // missing objectKey/fileUrl" for the app's most common input. Delegating to
  // the shared resolver teaches every one of them all the forms at once.
  //
  // objectKey is a storage key rather than a url, so it is resolved against
  // baseDir first and then contained the same way.
  const target =
    objectKey && typeof objectKey === 'string'
      ? path.resolve(baseDir, objectKey)
      : (fileUrl && typeof fileUrl === 'string' ? fileUrl : null);

  if (!target) return null;

  // Fully validated (including symlink containment) when the file is present.
  const strict = resolveLocalAudioPath(target);
  if (strict) return strict;

  // Absent file: hand back the contained candidate so the callers keep their
  // "400 for a bad reference, 404 for a real reference with no file" split.
  // Only ever returned when the file does NOT exist, so a symlink that escapes
  // the objects directory cannot be reached through this branch.
  const candidate = resolveLocalAudioPath(target, { allowMissing: true });
  if (candidate && !fs.existsSync(candidate)) return candidate;

  return null;
}

/**
 * Validate a URL for SSRF protection.
 * Only allows http/https and blocks internal/private network hosts.
 */
export function isAllowedUrl(urlString: string): { valid: boolean; parsed?: URL; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only http/https URLs are allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block private/internal network ranges
  const blockedPatterns = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^fd[0-9a-f]{2}:/i,
    /^fe80:/i,
    /^169\.254\.\d+\.\d+$/,
    /\.local$/i,
    /\.internal$/i,
    /\.corp$/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'URL host is not allowed' };
    }
  }

  return { valid: true, parsed };
}

/**
 * Validate a filename to prevent path traversal in file serving routes.
 * Only allows alphanumeric, dash, underscore, dot, and space.
 */
export function validateFilename(filename: string): string | null {
  if (!filename || typeof filename !== 'string') return null;

  const cleaned = filename.trim();
  if (cleaned.length === 0 || cleaned.length > 255) return null;

  // Block path traversal
  if (cleaned.includes('..') || cleaned.includes('/') || cleaned.includes('\\')) {
    return null;
  }

  // Only allow safe characters
  if (!/^[a-zA-Z0-9\-_. ]+$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}
