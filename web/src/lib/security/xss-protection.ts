/**
 * XSS Protection Utilities
 * Prevents Cross-Site Scripting attacks through input sanitization and CSP
 * Requirements: 12.1, 12.7
 */

import DOMPurify from 'isomorphic-dompurify';

export interface XSSProtectionConfig {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripIgnoreTag?: boolean;
  stripIgnoreTagBody?: string[];
}

export class XSSProtector {
  private config: XSSProtectionConfig;

  constructor(config: XSSProtectionConfig = {}) {
    this.config = {
      allowedTags: [
        'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'span', 'div',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'td', 'th'
      ],
      allowedAttributes: {
        'a': ['href', 'title', 'target'],
        'img': ['src', 'alt', 'title', 'width', 'height'],
        'span': ['class'],
        'div': ['class'],
        'p': ['class'],
        '*': ['id', 'class']
      },
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
      ...config
    };
  }

  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  sanitizeHTML(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    try {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: this.config.allowedTags,
        ALLOWED_ATTR: Object.keys(this.config.allowedAttributes || {}),
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        RETURN_TRUSTED_TYPE: false
      });
    } catch (error) {
      console.error('HTML sanitization failed:', error);
      return '';
    }
  }

  /**
   * Sanitize text input by escaping HTML entities
   */
  sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize URL to prevent javascript: and data: schemes
   */
  sanitizeURL(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    // Remove dangerous protocols
    const dangerousProtocols = /^(javascript|data|vbscript|file|about):/i;
    if (dangerousProtocols.test(url.trim())) {
      return '';
    }

    // Allow only http, https, mailto, tel, and relative URLs
    const allowedProtocols = /^(https?:|mailto:|tel:|\/|\.\/|\.\.\/)/i;
    if (!allowedProtocols.test(url.trim()) && !url.startsWith('#')) {
      return '';
    }

    return url;
  }

  /**
   * Validate and sanitize JSON input
   */
  sanitizeJSON(input: unknown): unknown {
    if (typeof input === 'string') {
      return this.sanitizeText(input);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeJSON(item));
    }

    if (input && typeof input === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        const sanitizedKey = this.sanitizeText(key);
        sanitized[sanitizedKey] = this.sanitizeJSON(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Check if content contains potential XSS vectors
   */
  containsXSS(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<link\b[^>]*>/gi,
      /<meta\b[^>]*>/gi,
      /expression\s*\(/gi,
      /url\s*\(\s*javascript:/gi,
      /@import/gi,
      /vbscript:/gi,
      /data:text\/html/gi
    ];

    return xssPatterns.some(pattern => pattern.test(content));
  }
}

// Default XSS protector instance
export const xssProtector = new XSSProtector();

/**
 * Utility functions for common XSS protection scenarios
 */
export const sanitizeHTML = (html: string): string => xssProtector.sanitizeHTML(html);
export const sanitizeText = (text: string): string => xssProtector.sanitizeText(text);
export const sanitizeURL = (url: string): string => xssProtector.sanitizeURL(url);
export const sanitizeJSON = (input: unknown): unknown => xssProtector.sanitizeJSON(input);
export const containsXSS = (content: string): boolean => xssProtector.containsXSS(content);

/**
 * React hook for XSS protection
 */
export function useXSSProtection() {
  return {
    sanitizeHTML,
    sanitizeText,
    sanitizeURL,
    sanitizeJSON,
    containsXSS
  };
}