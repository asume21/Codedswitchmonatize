/**
 * Security Utilities for CodedSwitch
 * Handles path sanitization, input validation, and XSS prevention
 */

import path from 'path';

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
