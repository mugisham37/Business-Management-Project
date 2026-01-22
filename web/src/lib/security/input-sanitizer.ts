/**
 * Input Sanitization Utilities
 * Comprehensive input validation and sanitization for all user inputs
 * Requirements: 12.7
 */

import { z } from 'zod';
import { sanitizeHTML, sanitizeText, sanitizeURL } from './xss-protection';

export interface SanitizationRule {
  type: 'text' | 'html' | 'url' | 'email' | 'phone' | 'number' | 'json' | 'custom';
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  allowedChars?: string;
  customSanitizer?: (input: unknown) => unknown;
  validator?: z.ZodSchema;
}

export interface SanitizationResult {
  sanitized: unknown;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class InputSanitizer {
  private rules: Map<string, SanitizationRule> = new Map();

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * Register a sanitization rule for a field
   */
  registerRule(fieldName: string, rule: SanitizationRule): void {
    this.rules.set(fieldName, rule);
  }

  /**
   * Sanitize input based on registered rules
   */
  sanitize(fieldName: string, input: unknown): SanitizationResult {
    const rule = this.rules.get(fieldName);
    
    if (!rule) {
      return {
        sanitized: input,
        isValid: true,
        errors: [],
        warnings: [`No sanitization rule found for field: ${fieldName}`]
      };
    }

    return this.applySanitizationRule(input, rule);
  }

  /**
   * Sanitize an object with multiple fields
   */
  sanitizeObject(data: Record<string, unknown>): Record<string, SanitizationResult> {
    const results: Record<string, SanitizationResult> = {};

    for (const [fieldName, value] of Object.entries(data)) {
      results[fieldName] = this.sanitize(fieldName, value);
    }

    return results;
  }

  /**
   * Sanitize and validate form data
   */
  sanitizeFormData(formData: FormData): Record<string, SanitizationResult> {
    const results: Record<string, SanitizationResult> = {};

    for (const [key, value] of formData.entries()) {
      results[key] = this.sanitize(key, value);
    }

    return results;
  }

  /**
   * Get sanitized values from sanitization results
   */
  getSanitizedValues(results: Record<string, SanitizationResult>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, result] of Object.entries(results)) {
      if (result.isValid) {
        sanitized[key] = result.sanitized;
      }
    }

    return sanitized;
  }

  /**
   * Get all errors from sanitization results
   */
  getErrors(results: Record<string, SanitizationResult>): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    for (const [key, result] of Object.entries(results)) {
      if (result.errors.length > 0) {
        errors[key] = result.errors;
      }
    }

    return errors;
  }

  private applySanitizationRule(input: unknown, rule: SanitizationRule): SanitizationResult {
    const result: SanitizationResult = {
      sanitized: input,
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Apply type-specific sanitization
      switch (rule.type) {
        case 'text':
          result.sanitized = this.sanitizeTextInput(input, rule);
          break;
        case 'html':
          result.sanitized = this.sanitizeHTMLInput(input, rule);
          break;
        case 'url':
          result.sanitized = this.sanitizeURLInput(input, rule);
          break;
        case 'email':
          result.sanitized = this.sanitizeEmailInput(input, rule);
          break;
        case 'phone':
          result.sanitized = this.sanitizePhoneInput(input, rule);
          break;
        case 'number':
          result.sanitized = this.sanitizeNumberInput(input, rule);
          break;
        case 'json':
          result.sanitized = this.sanitizeJSONInput(input, rule);
          break;
        case 'custom':
          if (rule.customSanitizer) {
            result.sanitized = rule.customSanitizer(input);
          }
          break;
        default:
          result.warnings.push(`Unknown sanitization type: ${rule.type}`);
      }

      // Apply length validation
      if (rule.minLength !== undefined || rule.maxLength !== undefined) {
        const length = typeof result.sanitized === 'string' ? result.sanitized.length : 0;
        
        if (rule.minLength !== undefined && length < rule.minLength) {
          result.errors.push(`Input too short. Minimum length: ${rule.minLength}`);
          result.isValid = false;
        }
        
        if (rule.maxLength !== undefined && length > rule.maxLength) {
          result.errors.push(`Input too long. Maximum length: ${rule.maxLength}`);
          result.isValid = false;
        }
      }

      // Apply pattern validation
      if (rule.pattern && typeof result.sanitized === 'string') {
        if (!rule.pattern.test(result.sanitized)) {
          result.errors.push('Input does not match required pattern');
          result.isValid = false;
        }
      }

      // Apply Zod validation if provided
      if (rule.validator) {
        const validation = rule.validator.safeParse(result.sanitized);
        if (!validation.success) {
          result.errors.push(...validation.error.errors.map(e => e.message));
          result.isValid = false;
        }
      }

    } catch (error) {
      result.errors.push(`Sanitization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  private sanitizeTextInput(input: unknown, _rule: SanitizationRule): string {
    let str: string;
    if (typeof input === 'string') {
      str = input;
    } else {
      str = String(input || '');
    }

    let sanitized = sanitizeText(str);

    // Apply allowed characters filter if specified
    if (_rule.allowedChars) {
      const allowedPattern = new RegExp(`[^${_rule.allowedChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g');
      sanitized = sanitized.replace(allowedPattern, '');
    }

    return sanitized.trim();
  }

  private sanitizeHTMLInput(input: unknown, _rule: SanitizationRule): string {
    let str: string;
    if (typeof input === 'string') {
      str = input;
    } else {
      str = String(input || '');
    }

    return sanitizeHTML(str);
  }

  private sanitizeURLInput(input: unknown, _rule: SanitizationRule): string {
    let str: string;
    if (typeof input === 'string') {
      str = input;
    } else {
      str = String(input || '');
    }

    return sanitizeURL(str);
  }

  private sanitizeEmailInput(input: unknown, _rule: SanitizationRule): string {
    let str: string;
    if (typeof input === 'string') {
      str = input;
    } else {
      str = String(input || '');
    }

    // Basic email sanitization
    return str.toLowerCase().trim();
  }

  private sanitizePhoneInput(input: unknown, _rule: SanitizationRule): string {
    let str: string;
    if (typeof input === 'string') {
      str = input;
    } else {
      str = String(input || '');
    }

    // Remove all non-digit characters except + and -
    return str.replace(/[^\d+\-\s()]/g, '').trim();
  }

  private sanitizeNumberInput(input: unknown, _rule: SanitizationRule): number | string {
    const num = Number(input);
    return isNaN(num) ? input : num;
  }

  private sanitizeJSONInput(input: unknown, _rule: SanitizationRule): unknown {
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch {
        return null;
      }
    }
    return input;
  }

  private setupDefaultRules(): void {
    // Common field rules
    this.registerRule('email', {
      type: 'email',
      maxLength: 254,
      validator: z.string().email().optional().or(z.literal(''))
    });

    this.registerRule('password', {
      type: 'text',
      minLength: 8,
      maxLength: 128
    });

    this.registerRule('username', {
      type: 'text',
      minLength: 3,
      maxLength: 50,
      allowedChars: 'a-zA-Z0-9_-',
      pattern: /^[a-zA-Z0-9_-]+$/
    });

    this.registerRule('name', {
      type: 'text',
      maxLength: 100,
      allowedChars: 'a-zA-Z\\s\\-\\.'
    });

    this.registerRule('phone', {
      type: 'phone',
      maxLength: 20
    });

    this.registerRule('url', {
      type: 'url',
      maxLength: 2048
    });

    this.registerRule('description', {
      type: 'html',
      maxLength: 5000
    });

    this.registerRule('comment', {
      type: 'html',
      maxLength: 1000
    });
  }
}

// Default input sanitizer instance
export const inputSanitizer = new InputSanitizer();

/**
 * Utility functions for common sanitization scenarios
 */
export const sanitizeInput = (fieldName: string, input: unknown): SanitizationResult => {
  return inputSanitizer.sanitize(fieldName, input);
};

export const sanitizeFormInputs = (data: Record<string, unknown>): Record<string, SanitizationResult> => {
  return inputSanitizer.sanitizeObject(data);
};

/**
 * React hook for input sanitization
 */
export function useInputSanitization() {
  return {
    sanitize: sanitizeInput,
    sanitizeObject: sanitizeFormInputs,
    registerRule: (fieldName: string, rule: SanitizationRule) => {
      inputSanitizer.registerRule(fieldName, rule);
    }
  };
}