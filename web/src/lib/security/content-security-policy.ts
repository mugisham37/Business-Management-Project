/**
 * Content Security Policy (CSP) Configuration
 * Prevents XSS attacks through strict content policies
 * Requirements: 12.1
 */

import { randomBytes } from 'crypto';

export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'child-src'?: string[];
  'frame-src'?: string[];
  'worker-src'?: string[];
  'frame-ancestors'?: string[];
  'form-action'?: string[];
  'base-uri'?: string[];
  'manifest-src'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

export interface CSPConfig {
  reportOnly?: boolean;
  reportUri?: string;
  nonce?: string;
  directives: CSPDirectives;
}

export class ContentSecurityPolicy {
  private config: CSPConfig;

  constructor(config: CSPConfig) {
    this.config = config;
  }

  /**
   * Generate CSP header value
   */
  generateHeader(): string {
    const directives: string[] = [];

    for (const [directive, value] of Object.entries(this.config.directives)) {
      if (value === true) {
        directives.push(directive);
      } else if (Array.isArray(value) && value.length > 0) {
        directives.push(`${directive} ${value.join(' ')}`);
      }
    }

    if (this.config.reportUri) {
      directives.push(`report-uri ${this.config.reportUri}`);
    }

    return directives.join('; ');
  }

  /**
   * Get CSP header name
   */
  getHeaderName(): string {
    return this.config.reportOnly 
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
  }

  /**
   * Generate nonce for inline scripts/styles
   */
  generateNonce(): string {
    return randomBytes(16).toString('base64');
  }

  /**
   * Add nonce to script-src and style-src
   */
  addNonce(nonce: string): void {
    if (this.config.directives['script-src']) {
      this.config.directives['script-src'].push(`'nonce-${nonce}'`);
    }
    if (this.config.directives['style-src']) {
      this.config.directives['style-src'].push(`'nonce-${nonce}'`);
    }
  }

  /**
   * Create CSP for development environment
   */
  static createDevelopmentCSP(): ContentSecurityPolicy {
    return new ContentSecurityPolicy({
      reportOnly: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'unsafe-eval'", // Required for development
          "'unsafe-inline'", // Required for development
          'localhost:*',
          '127.0.0.1:*',
          'ws://localhost:*',
          'ws://127.0.0.1:*'
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'", // Required for CSS-in-JS
          'fonts.googleapis.com'
        ],
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https:'
        ],
        'font-src': [
          "'self'",
          'fonts.gstatic.com',
          'data:'
        ],
        'connect-src': [
          "'self'",
          'localhost:*',
          '127.0.0.1:*',
          'ws://localhost:*',
          'ws://127.0.0.1:*',
          'wss://localhost:*',
          'wss://127.0.0.1:*'
        ],
        'media-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      }
    });
  }

  /**
   * Create CSP for production environment
   */
  static createProductionCSP(domain: string): ContentSecurityPolicy {
    return new ContentSecurityPolicy({
      reportOnly: false,
      reportUri: '/api/csp-report',
      directives: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          `https://${domain}`,
          "'strict-dynamic'" // Allow dynamically loaded scripts
        ],
        'style-src': [
          "'self'",
          `https://${domain}`,
          'fonts.googleapis.com',
          "'unsafe-inline'" // Required for CSS-in-JS libraries
        ],
        'img-src': [
          "'self'",
          `https://${domain}`,
          'data:',
          'https:'
        ],
        'font-src': [
          "'self'",
          `https://${domain}`,
          'fonts.gstatic.com',
          'data:'
        ],
        'connect-src': [
          "'self'",
          `https://${domain}`,
          `wss://${domain}`
        ],
        'media-src': [
          "'self'",
          `https://${domain}`
        ],
        'object-src': ["'none'"],
        'frame-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': true,
        'block-all-mixed-content': true
      }
    });
  }

  /**
   * Create CSP middleware for Next.js
   */
  static createMiddleware(isDevelopment: boolean = false, domain?: string) {
    return (req: Record<string, unknown>, res: Record<string, unknown> & { setHeader?: (key: string, value: string) => void }, next: () => void) => {
      const csp = isDevelopment 
        ? ContentSecurityPolicy.createDevelopmentCSP()
        : ContentSecurityPolicy.createProductionCSP(domain || (req.headers as Record<string, unknown>)?.host as string);

      // Generate nonce for this request
      const nonce = csp.generateNonce();
      csp.addNonce(nonce);

      // Set CSP header
      res.setHeader?.(csp.getHeaderName(), csp.generateHeader());

      // Make nonce available to the request
      req.cspNonce = nonce;

      next();
    };
  }
}

/**
 * CSP violation report handler
 */
export interface CSPViolationReport {
  'document-uri': string;
  referrer: string;
  'violated-directive': string;
  'effective-directive': string;
  'original-policy': string;
  disposition: string;
  'blocked-uri': string;
  'line-number': number;
  'column-number': number;
  'source-file': string;
  'status-code': number;
  'script-sample': string;
}

export class CSPReportHandler {
  private reports: CSPViolationReport[] = [];
  private maxReports: number = 1000;

  /**
   * Handle CSP violation report
   */
  handleReport(report: CSPViolationReport): void {
    // Add timestamp
    const timestampedReport = {
      ...report,
      timestamp: new Date().toISOString()
    };

    this.reports.push(timestampedReport);

    // Keep only recent reports
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(-this.maxReports);
    }

    // Log violation (in production, send to monitoring service)
    console.warn('CSP Violation:', timestampedReport);

    // Check for potential attacks
    this.analyzeViolation(report);
  }

  /**
   * Get recent CSP violation reports
   */
  getReports(limit: number = 100): (CSPViolationReport & { timestamp?: string })[] {
    return this.reports.slice(-limit) as (CSPViolationReport & { timestamp?: string })[];
  }

  /**
   * Analyze CSP violation for potential attacks
   */
  private analyzeViolation(report: CSPViolationReport): void {
    const suspiciousPatterns = [
      /javascript:/i,
      /data:text\/html/i,
      /eval\(/i,
      /<script/i,
      /on\w+=/i
    ];

    const blockedUri = report['blocked-uri'];
    const scriptSample = report['script-sample'];

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(blockedUri) || pattern.test(scriptSample)
    );

    if (isSuspicious) {
      console.error('Potential XSS attack detected:', {
        blockedUri,
        scriptSample,
        documentUri: report['document-uri'],
        violatedDirective: report['violated-directive']
      });

      // In production, trigger security alert
      this.triggerSecurityAlert(report);
    }
  }

  /**
   * Trigger security alert for suspicious violations
   */
  private triggerSecurityAlert(report: CSPViolationReport): void {
    // In production, this would send alerts to security team
    console.error('SECURITY ALERT: Potential XSS attack detected', report);
  }
}

// Default CSP report handler
export const cspReportHandler = new CSPReportHandler();