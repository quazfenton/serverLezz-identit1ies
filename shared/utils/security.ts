/**
 * Security Utilities
 * Provides sanitization, secure ID generation, and sensitive data protection
 */

import crypto from 'crypto';
import sanitizeHtml from 'sanitize-html';

// Private IP ranges for SSRF protection
const PRIVATE_IP_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.0.0/16
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // 169.254.0.0/16 (link-local)
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 127.0.0.0/8 (loopback)
  /^0\.0\.0\.0$/, // 0.0.0.0
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
];

// Localhost patterns
const LOCALHOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
];

// Blocked internal hostnames
const BLOCKED_HOSTNAMES = [
  'metadata.google.internal',
  'metadata.azure.internal',
  'metadata.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
  'kubernetes.default.svc.cluster.local',
];

/**
 * Sanitize sensitive data from logs (API keys, tokens, secrets)
 */
export function sanitizeLogInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  return input
    // OpenAI API keys
    .replace(/(sk-[a-zA-Z0-9]{32,})/g, 'sk-***REDACTED***')
    // Anthropic API keys
    .replace(/(sk-ant-[a-zA-Z0-9-_]{32,})/g, 'sk-ant-***REDACTED***')
    // Google API keys
    .replace(/(AIza[a-zA-Z0-9-_]{35})/g, 'AIza***REDACTED***')
    // Bearer tokens (JWT)
    .replace(/(Bearer [a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+)/g, 'Bearer ***REDACTED***')
    // Generic secrets/passwords in environment variables
    .replace(/(password|secret|key|token)[\s]*[=:][\s]*["']?[a-zA-Z0-9\-_]{8,}["']?/gi, '$1=***REDACTED***')
    // Email addresses (privacy)
    .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@***.***');
}

/**
 * Sanitize HTML input to prevent XSS attacks
 */
export function sanitizeInput(input: any): any {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    // Remove all HTML tags - plain text only
    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'discard',
      textFilter: (text) => {
        return text
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/on\w+="[^"]*"/g, '');
      }
    });
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }

  if (typeof input === 'object' && input.constructor === Object) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Skip internal/symbol keys
      if (!key.startsWith('__') && !key.startsWith('$$')) {
        sanitized[key] = sanitizeInput(value);
      }
    }
    return sanitized;
  }

  // Return primitives as-is
  return input;
}

/**
 * Generate cryptographically secure random ID
 */
export function generateSecureId(prefix: string = 'id'): string {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}_${randomBytes}`;
}

/**
 * Generate secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash sensitive data (for storage)
 */
export async function hashData(data: string, saltRounds: number = 10): Promise<string> {
  const bcrypt = await import('bcrypt');
  return bcrypt.hash(data, saltRounds);
}

/**
 * Verify hashed data
 */
export async function verifyData(data: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcrypt');
  return bcrypt.compare(data, hash);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rate limit key generator (uses IP + user agent fingerprint)
 */
export function generateRateLimitKey(req: any): string {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const ua = req.get('user-agent') || 'unknown';
  const fingerprint = crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 16);
  return fingerprint;
}

/**
 * Truncate string safely (without cutting words)
 */
export function safeTruncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;

  let truncated = str.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    truncated = truncated.substring(0, lastSpace);
  }

  return truncated + suffix;
}

/**
 * Escape special regex characters in string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deep clone object (handles circular references)
 */
export function deepClone<T>(obj: T, seen = new WeakMap()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (seen.has(obj)) {
    return seen.get(obj);
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (Array.isArray(obj)) {
    const cloned = obj.map(item => deepClone(item, seen));
    seen.set(obj, cloned);
    return cloned as unknown as T;
  }

  const cloned = {} as T;
  seen.set(obj, cloned);

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      (cloned as any)[key] = deepClone((obj as any)[key], seen);
    }
  }

  return cloned;
}

/**
 * Pick specific fields from object
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific fields from object
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete (result as any)[key];
  }
  return result;
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: any): boolean {
  if (obj === null || obj === undefined) return true;
  if (typeof obj === 'string') return obj.trim().length === 0;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Check if an IP address is private/internal
 */
export function isPrivateIP(ip: string): boolean {
  const normalizedIP = ip.trim().toLowerCase();
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(normalizedIP));
}

/**
 * Check if hostname is localhost or internal
 */
export function isLocalhost(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();
  return LOCALHOST_PATTERNS.some((pattern) => pattern.test(normalizedHostname));
}

/**
 * Validate URL for SSRF protection
 * 
 * This function:
 * - Validates URL format
 * - Ensures only http/https protocols
 * - Blocks private/internal IP addresses
 * - Blocks localhost
 * - Blocks known internal hostnames
 */
export function validateURL(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  let parsedURL: URL;
  
  try {
    parsedURL = new URL(url.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Check protocol
  if (!['http:', 'https:'].includes(parsedURL.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  const hostname = parsedURL.hostname.toLowerCase();

  // Check for localhost
  if (isLocalhost(hostname)) {
    return { valid: false, error: 'Localhost URLs are not allowed' };
  }

  // Check for private IP addresses
  if (isPrivateIP(hostname)) {
    return { valid: false, error: 'Internal IP addresses are not allowed' };
  }

  // Block internal hostnames
  if (BLOCKED_HOSTNAMES.some((blocked) => hostname.includes(blocked))) {
    return { valid: false, error: 'Internal hostnames are not allowed' };
  }

  // Block IP address literals
  const ipLiteralPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipLiteralPattern.test(hostname)) {
    return { valid: false, error: 'IP address literals are not allowed' };
  }

  return { valid: true };
}

/**
 * Sanitize URL for safe use
 */
export function sanitizeURL(url: string): string | null {
  if (!url) return null;

  // First validate for SSRF
  const validation = validateURL(url);
  if (!validation.valid) {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    
    // Sanitize hostname (remove dangerous characters)
    const safeHostname = parsed.hostname.replace(/[^\w.-]/g, '');
    parsed.hostname = safeHostname;
    
    // Sanitize pathname
    parsed.pathname = parsed.pathname.replace(/[^\w./-]/g, '');
    
    // Clear hash
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
