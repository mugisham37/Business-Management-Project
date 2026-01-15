import { Transform } from 'class-transformer';

/**
 * Sanitize string by trimming whitespace
 */
export function Trim() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  });
}

/**
 * Convert string to lowercase
 */
export function ToLowerCase() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return value;
  });
}

/**
 * Convert string to uppercase
 */
export function ToUpperCase() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  });
}

/**
 * Sanitize HTML by removing potentially dangerous tags and attributes
 */
export function SanitizeHtml() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      // Basic HTML sanitization - remove script tags and event handlers
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '');
    }
    return value;
  });
}

/**
 * Remove all HTML tags
 */
export function StripHtml() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.replace(/<[^>]*>/g, '');
    }
    return value;
  });
}

/**
 * Normalize phone number by removing non-digit characters except +
 */
export function NormalizePhoneNumber() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.replace(/[^\d+]/g, '');
    }
    return value;
  });
}

/**
 * Convert to slug format (lowercase, alphanumeric, hyphens)
 */
export function ToSlug() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }
    return value;
  });
}

/**
 * Escape special characters for SQL-like queries
 */
export function EscapeSpecialChars() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace (/\x00/g, '\\0')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\x1a/g, '\\Z');
    }
    return value;
  });
}

/**
 * Convert monetary amount to cents (multiply by 100 and round)
 */
export function ToCents() {
  return Transform(({ value }) => {
    if (typeof value === 'number') {
      return Math.round(value * 100);
    }
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? value : Math.round(num * 100);
    }
    return value;
  });
}

/**
 * Convert cents to monetary amount (divide by 100)
 */
export function FromCents() {
  return Transform(({ value }) => {
    if (typeof value === 'number') {
      return value / 100;
    }
    return value;
  });
}

/**
 * Parse JSON string to object
 */
export function ParseJson() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  });
}

/**
 * Convert array of strings to comma-separated string
 */
export function ArrayToString(separator: string = ',') {
  return Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.join(separator);
    }
    return value;
  });
}

/**
 * Convert comma-separated string to array
 */
export function StringToArray(separator: string = ',') {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(separator).map(item => item.trim()).filter(item => item.length > 0);
    }
    return value;
  });
}

/**
 * Remove duplicate values from array
 */
export function RemoveDuplicates() {
  return Transform(({ value }) => {
    if (Array.isArray(value)) {
      return [...new Set(value)];
    }
    return value;
  });
}

/**
 * Normalize URL by ensuring it has a protocol
 */
export function NormalizeUrl() {
  return Transform(({ value }) => {
    if (typeof value === 'string' && value.length > 0) {
      if (!value.match(/^https?:\/\//)) {
        return `https://${value}`;
      }
    }
    return value;
  });
}

/**
 * Mask sensitive data (show only first and last few characters)
 */
export function MaskSensitive(visibleStart: number = 2, visibleEnd: number = 2, maskChar: string = '*') {
  return Transform(({ value }) => {
    if (typeof value === 'string' && value.length > visibleStart + visibleEnd) {
      const start = value.substring(0, visibleStart);
      const end = value.substring(value.length - visibleEnd);
      const middle = maskChar.repeat(value.length - visibleStart - visibleEnd);
      return start + middle + end;
    }
    return value;
  });
}