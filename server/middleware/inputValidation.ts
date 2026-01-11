import { Request, Response, NextFunction } from 'express';

/**
 * Input Validation Middleware
 * Prevents malicious or oversized inputs from causing issues
 */

/**
 * Validate text input length
 */
export function validateTextLength(field: string, maxLength: number = 5000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (value && typeof value === 'string' && value.length > maxLength) {
      return res.status(400).json({
        error: 'Input too long',
        message: `${field} must be ${maxLength} characters or less`,
        field,
        maxLength,
        currentLength: value.length,
      });
    }
    
    next();
  };
}

/**
 * Validate prompt for AI generation
 */
export const validatePrompt = (req: Request, res: Response, next: NextFunction) => {
  const { prompt, description, lyrics, content } = req.body;
  const textToValidate = prompt || description || lyrics || content;
  
  if (textToValidate && typeof textToValidate === 'string') {
    // Max 10,000 characters for prompts
    if (textToValidate.length > 10000) {
      return res.status(400).json({
        error: 'Prompt too long',
        message: 'Prompt must be 10,000 characters or less',
        maxLength: 10000,
        currentLength: textToValidate.length,
      });
    }
    
    // Check for suspicious patterns (basic XSS prevention)
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // onclick, onerror, etc.
      /<iframe/i,
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(textToValidate)) {
        return res.status(400).json({
          error: 'Invalid input',
          message: 'Input contains potentially malicious content',
        });
      }
    }
  }
  
  next();
};

/**
 * Validate file size
 */
export function validateFileSize(maxSizeMB: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { fileSize } = req.body;
    
    if (fileSize && typeof fileSize === 'number') {
      const maxBytes = maxSizeMB * 1024 * 1024;
      
      if (fileSize > maxBytes) {
        return res.status(400).json({
          error: 'File too large',
          message: `File must be ${maxSizeMB}MB or less`,
          maxSize: maxSizeMB,
          currentSize: Math.round(fileSize / 1024 / 1024),
        });
      }
    }
    
    next();
  };
}

/**
 * Validate numeric range
 */
export function validateRange(field: string, min: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (value !== undefined && value !== null) {
      const num = Number(value);
      
      if (isNaN(num)) {
        return res.status(400).json({
          error: 'Invalid number',
          message: `${field} must be a valid number`,
          field,
        });
      }
      
      if (num < min || num > max) {
        return res.status(400).json({
          error: 'Out of range',
          message: `${field} must be between ${min} and ${max}`,
          field,
          min,
          max,
          value: num,
        });
      }
    }
    
    next();
  };
}

/**
 * Validate required fields
 */
export function validateRequired(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing: string[] = [];
    
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: `The following fields are required: ${missing.join(', ')}`,
        missing,
      });
    }
    
    next();
  };
}

/**
 * Sanitize string input (remove dangerous characters)
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
