/**
 * Error Logger and Monitoring System
 * 
 * Provides secure error logging with PII protection, error reporting integration,
 * and error analytics with alerting capabilities.
 */

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context: {
    userId?: string;
    tenantId?: string;
    sessionId?: string;
    operationId?: string;
    component?: string;
    url?: string;
    userAgent?: string;
    buildVersion?: string;
  };
  metadata: Record<string, unknown>;
  fingerprint?: string;
  tags: string[];
}

export interface ErrorReportingConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  environment: 'development' | 'staging' | 'production';
  sampleRate: number;
  beforeSend?: (entry: ErrorLogEntry) => ErrorLogEntry | null;
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByComponent: Record<string, number>;
  errorsByUser: Record<string, number>;
  errorsByTenant: Record<string, number>;
  recentErrors: ErrorLogEntry[];
  errorTrends: {
    hourly: number[];
    daily: number[];
  };
}

/**
 * PII Sanitizer - removes sensitive information from error data
 */
class PIISanitizer {
  private static readonly PII_PATTERNS = [
    // Email addresses
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    // Phone numbers
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    // Credit card numbers
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    // Social security numbers
    /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    // API keys and tokens (common patterns)
    /\b[A-Za-z0-9]{32,}\b/g,
    // JWT tokens
    /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g,
  ];

  private static readonly SENSITIVE_KEYS = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'credential',
    'private',
    'confidential',
  ];

  static sanitizeString(input: string): string {
    let sanitized = input;
    
    // Replace PII patterns with placeholders
    this.PII_PATTERNS.forEach((pattern, index) => {
      sanitized = sanitized.replace(pattern, `[REDACTED_PII_${index}]`);
    });
    
    return sanitized;
  }

  static sanitizeObject(obj: unknown, depth = 0): unknown {
    if (depth > 10) return '[MAX_DEPTH_REACHED]'; // Prevent infinite recursion
    
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }
    
    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Check if key contains sensitive information
        const isSensitive = this.SENSITIVE_KEYS.some(sensitiveKey => 
          lowerKey.includes(sensitiveKey)
        );
        
        if (isSensitive) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeObject(value, depth + 1);
        }
      }
      
      return sanitized;
    }
    
    return obj;
  }
}

/**
 * Error Fingerprinting - creates unique identifiers for similar errors
 */
class ErrorFingerprinter {
  static generateFingerprint(error: Error, context: Partial<ErrorLogEntry['context']>): string {
    const components = [
      error.name,
      this.normalizeMessage(error.message),
      this.extractStackSignature(error.stack),
      context.component || 'unknown',
    ];
    
    const fingerprint = components.join('|');
    return this.hashString(fingerprint);
  }

  private static normalizeMessage(message: string): string {
    // Remove dynamic parts like IDs, timestamps, etc.
    return message
      .replace(/\b\d+\b/g, 'N') // Replace numbers with N
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, 'UUID') // Replace UUIDs
      .replace(/\b[A-Za-z0-9]{20,}\b/g, 'TOKEN') // Replace long tokens
      .toLowerCase();
  }

  private static extractStackSignature(stack?: string): string {
    if (!stack) return 'no-stack';
    
    // Extract the first few lines of the stack trace for signature
    const lines = stack.split('\n').slice(0, 3);
    return lines
      .map(line => line.replace(/:\d+:\d+/g, ':N:N')) // Remove line numbers
      .join('|');
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Error Logger Class
 */
export class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private maxLogs = 1000;
  private reportingConfig: ErrorReportingConfig;
  private sessionId: string;

  constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.reportingConfig = {
      enabled: true,
      environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
      sampleRate: 1.0,
      ...config,
    };
    
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
  }

  /**
   * Log an error with context
   */
  logError(
    error: Error,
    context: Partial<ErrorLogEntry['context']> = {},
    metadata: Record<string, unknown> = {},
    tags: string[] = []
  ): string {
    const entry = this.createLogEntry('error', error.message, {
      error: {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack }),
      },
      context: {
        ...context,
        sessionId: this.sessionId,
        ...(typeof window !== 'undefined' && window.location.href && { url: window.location.href }),
        ...(typeof navigator !== 'undefined' && navigator.userAgent && { userAgent: navigator.userAgent }),
        ...(process.env.NEXT_PUBLIC_BUILD_VERSION && { buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION }),
      },
      metadata,
      tags,
    });

    this.addLogEntry(entry);
    this.reportError(entry);
    
    return entry.id;
  }

  /**
   * Log a warning
   */
  logWarning(
    message: string,
    context: Partial<ErrorLogEntry['context']> = {},
    metadata: Record<string, unknown> = {},
    tags: string[] = []
  ): string {
    const entry = this.createLogEntry('warn', message, {
      context: {
        ...context,
        sessionId: this.sessionId,
      },
      metadata,
      tags,
    });

    this.addLogEntry(entry);
    
    return entry.id;
  }

  /**
   * Log info message
   */
  logInfo(
    message: string,
    context: Partial<ErrorLogEntry['context']> = {},
    metadata: Record<string, unknown> = {},
    tags: string[] = []
  ): string {
    const entry = this.createLogEntry('info', message, {
      context: {
        ...context,
        sessionId: this.sessionId,
      },
      metadata,
      tags,
    });

    this.addLogEntry(entry);
    
    return entry.id;
  }

  /**
   * Get error analytics
   */
  getAnalytics(): ErrorAnalytics {
    const errorLogs = this.logs.filter(log => log.level === 'error');
    
    return {
      totalErrors: errorLogs.length,
      errorsByType: this.groupBy(errorLogs, log => log.error?.name || 'Unknown'),
      errorsByComponent: this.groupBy(errorLogs, log => log.context.component || 'Unknown'),
      errorsByUser: this.groupBy(errorLogs, log => log.context.userId || 'Anonymous'),
      errorsByTenant: this.groupBy(errorLogs, log => log.context.tenantId || 'Unknown'),
      recentErrors: errorLogs.slice(-10),
      errorTrends: this.calculateTrends(errorLogs),
    };
  }

  /**
   * Export logs for debugging
   */
  exportLogs(filter?: (entry: ErrorLogEntry) => boolean): ErrorLogEntry[] {
    const logsToExport = filter ? this.logs.filter(filter) : this.logs;
    return logsToExport.map(log => ({ ...log })); // Deep copy
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Update reporting configuration
   */
  updateReportingConfig(config: Partial<ErrorReportingConfig>): void {
    this.reportingConfig = { ...this.reportingConfig, ...config };
  }

  private createLogEntry(
    level: ErrorLogEntry['level'],
    message: string,
    options: {
      error?: ErrorLogEntry['error'];
      context?: Partial<ErrorLogEntry['context']>;
      metadata?: Record<string, unknown>;
      tags?: string[];
    } = {}
  ): ErrorLogEntry {
    const id = this.generateLogId();
    const timestamp = new Date().toISOString();
    
    // Sanitize all data to remove PII
    const sanitizedMetadata = PIISanitizer.sanitizeObject(options.metadata || {}) as Record<string, unknown>;
    const sanitizedContext = PIISanitizer.sanitizeObject(options.context || {}) as ErrorLogEntry['context'];
    const sanitizedMessage = PIISanitizer.sanitizeString(message);
    
    const entry: ErrorLogEntry = {
      id,
      timestamp,
      level,
      message: sanitizedMessage,
      context: sanitizedContext,
      metadata: sanitizedMetadata,
      tags: options.tags || [],
    };

    // Add error if provided
    if (options.error) {
      entry.error = {
        name: options.error.name,
        message: options.error.message,
        ...(options.error.stack && { stack: options.error.stack }),
      };
    }

    // Generate fingerprint for error deduplication
    if (options.error) {
      entry.fingerprint = ErrorFingerprinter.generateFingerprint(
        options.error,
        sanitizedContext
      );
    }

    return entry;
  }

  private addLogEntry(entry: ErrorLogEntry): void {
    this.logs.push(entry);
    
    // Maintain log size limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging in development
    if (this.reportingConfig.environment === 'development') {
      this.consoleLog(entry);
    }
  }

  private consoleLog(entry: ErrorLogEntry): void {
    const logMethod = entry.level === 'error' ? console.error :
                     entry.level === 'warn' ? console.warn :
                     console.log;

    logMethod(`[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`, {
      id: entry.id,
      context: entry.context,
      metadata: entry.metadata,
      error: entry.error,
    });
  }

  private async reportError(entry: ErrorLogEntry): Promise<void> {
    if (!this.reportingConfig.enabled || entry.level !== 'error') {
      return;
    }

    // Sample rate check
    if (Math.random() > this.reportingConfig.sampleRate) {
      return;
    }

    // Apply beforeSend filter
    const processedEntry = this.reportingConfig.beforeSend?.(entry) || entry;
    if (!processedEntry) {
      return;
    }

    try {
      if (this.reportingConfig.endpoint && this.reportingConfig.apiKey) {
        await this.sendToExternalService(processedEntry);
      }
    } catch (reportingError) {
      console.warn('Failed to report error to external service:', reportingError);
    }
  }

  private async sendToExternalService(entry: ErrorLogEntry): Promise<void> {
    const payload = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      fingerprint: entry.fingerprint,
      context: entry.context,
      metadata: entry.metadata,
      tags: entry.tags,
      environment: this.reportingConfig.environment,
    };

    await fetch(this.reportingConfig.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.reportingConfig.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  private setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return;

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        { component: 'global' },
        { reason: event.reason },
        ['unhandled-rejection']
      );
    });

    // Global JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError(
        new Error(event.message),
        { 
          component: 'global',
          url: event.filename,
        },
        {
          lineno: event.lineno,
          colno: event.colno,
        },
        ['global-error']
      );
    });
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, number> {
    return array.reduce((acc, item) => {
      const key = keyFn(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateTrends(errorLogs: ErrorLogEntry[]): { hourly: number[]; daily: number[] } {
    const now = Date.now();
    const hourly = new Array(24).fill(0);
    const daily = new Array(7).fill(0);

    errorLogs.forEach(log => {
      const logTime = new Date(log.timestamp).getTime();
      const hoursAgo = Math.floor((now - logTime) / (1000 * 60 * 60));
      const daysAgo = Math.floor((now - logTime) / (1000 * 60 * 60 * 24));

      if (hoursAgo < 24) {
        hourly[23 - hoursAgo]++;
      }

      if (daysAgo < 7) {
        daily[6 - daysAgo]++;
      }
    });

    return { hourly, daily };
  }
}

/**
 * Global error logger instance
 */
export const errorLogger = new ErrorLogger({
  enabled: true,
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  ...(process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT && {
    endpoint: process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT,
  }),
  ...(process.env.NEXT_PUBLIC_ERROR_REPORTING_API_KEY && {
    apiKey: process.env.NEXT_PUBLIC_ERROR_REPORTING_API_KEY,
  }),
});

/**
 * React hook for error logging
 */
export function useErrorLogger() {
  const logError = React.useCallback((
    error: Error,
    context?: Partial<ErrorLogEntry['context']>,
    metadata?: Record<string, unknown>,
    tags?: string[]
  ) => {
    return errorLogger.logError(error, context, metadata, tags);
  }, []);

  const logWarning = React.useCallback((
    message: string,
    context?: Partial<ErrorLogEntry['context']>,
    metadata?: Record<string, unknown>,
    tags?: string[]
  ) => {
    return errorLogger.logWarning(message, context, metadata, tags);
  }, []);

  const logInfo = React.useCallback((
    message: string,
    context?: Partial<ErrorLogEntry['context']>,
    metadata?: Record<string, unknown>,
    tags?: string[]
  ) => {
    return errorLogger.logInfo(message, context, metadata, tags);
  }, []);

  const getAnalytics = React.useCallback(() => {
    return errorLogger.getAnalytics();
  }, []);

  return {
    logError,
    logWarning,
    logInfo,
    getAnalytics,
  };
}

// Add React import
import React from 'react';