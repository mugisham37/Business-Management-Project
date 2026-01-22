/**
 * Security Headers Configuration
 * Comprehensive security headers for protection against various attacks
 * Requirements: 12.1, 12.2
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string;
  strictTransportSecurity?: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  xContentTypeOptions?: boolean;
  referrerPolicy?: 
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';
  permissionsPolicy?: Record<string, string[]>;
  crossOriginEmbedderPolicy?: 'unsafe-none' | 'require-corp';
  crossOriginOpenerPolicy?: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
  crossOriginResourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin';
  xDNSPrefetchControl?: boolean;
  expectCT?: {
    maxAge: number;
    enforce: boolean;
    reportUri?: string;
  };
}

export class SecurityHeaders {
  private config: SecurityHeadersConfig;

  constructor(config: SecurityHeadersConfig = {}) {
    this.config = {
      strictTransportSecurity: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      xFrameOptions: 'DENY',
      xContentTypeOptions: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: []
      },
      crossOriginEmbedderPolicy: 'require-corp',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
      xDNSPrefetchControl: true,
      expectCT: {
        maxAge: 86400, // 24 hours
        enforce: true
      },
      ...config
    };
  }

  /**
   * Generate all security headers
   */
  generateHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // Content Security Policy
    if (this.config.contentSecurityPolicy) {
      headers['Content-Security-Policy'] = this.config.contentSecurityPolicy;
    }

    // Strict Transport Security
    if (this.config.strictTransportSecurity) {
      const hsts = this.config.strictTransportSecurity;
      let hstsValue = `max-age=${hsts.maxAge}`;
      if (hsts.includeSubDomains) hstsValue += '; includeSubDomains';
      if (hsts.preload) hstsValue += '; preload';
      headers['Strict-Transport-Security'] = hstsValue;
    }

    // X-Frame-Options
    if (this.config.xFrameOptions) {
      headers['X-Frame-Options'] = this.config.xFrameOptions;
    }

    // X-Content-Type-Options
    if (this.config.xContentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // Referrer Policy
    if (this.config.referrerPolicy) {
      headers['Referrer-Policy'] = this.config.referrerPolicy;
    }

    // Permissions Policy
    if (this.config.permissionsPolicy) {
      const policies = Object.entries(this.config.permissionsPolicy)
        .map(([directive, allowlist]) => {
          const origins = allowlist.length > 0 ? `(${allowlist.join(' ')})` : '()';
          return `${directive}=${origins}`;
        });
      headers['Permissions-Policy'] = policies.join(', ');
    }

    // Cross-Origin Embedder Policy
    if (this.config.crossOriginEmbedderPolicy) {
      headers['Cross-Origin-Embedder-Policy'] = this.config.crossOriginEmbedderPolicy;
    }

    // Cross-Origin Opener Policy
    if (this.config.crossOriginOpenerPolicy) {
      headers['Cross-Origin-Opener-Policy'] = this.config.crossOriginOpenerPolicy;
    }

    // Cross-Origin Resource Policy
    if (this.config.crossOriginResourcePolicy) {
      headers['Cross-Origin-Resource-Policy'] = this.config.crossOriginResourcePolicy;
    }

    // X-DNS-Prefetch-Control
    if (this.config.xDNSPrefetchControl !== undefined) {
      headers['X-DNS-Prefetch-Control'] = this.config.xDNSPrefetchControl ? 'on' : 'off';
    }

    // Expect-CT
    if (this.config.expectCT) {
      const expectCT = this.config.expectCT;
      let expectCTValue = `max-age=${expectCT.maxAge}`;
      if (expectCT.enforce) expectCTValue += ', enforce';
      if (expectCT.reportUri) expectCTValue += `, report-uri="${expectCT.reportUri}"`;
      headers['Expect-CT'] = expectCTValue;
    }

    return headers;
  }

  /**
   * Create security headers for development environment
   */
  static createDevelopmentHeaders(): SecurityHeaders {
    return new SecurityHeaders({
      xFrameOptions: 'SAMEORIGIN', // Allow framing for development tools
      crossOriginEmbedderPolicy: 'unsafe-none', // Relaxed for development
      crossOriginOpenerPolicy: 'unsafe-none', // Relaxed for development
      crossOriginResourcePolicy: 'cross-origin', // Relaxed for development
      // strictTransportSecurity and expectCT are omitted for development (not undefined)
    });
  }

  /**
   * Create security headers for production environment
   */
  static createProductionHeaders(): SecurityHeaders {
    return new SecurityHeaders({
      strictTransportSecurity: {
        maxAge: 63072000, // 2 years
        includeSubDomains: true,
        preload: true
      },
      xFrameOptions: 'DENY',
      xContentTypeOptions: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: [],
        'display-capture': [],
        'document-domain': [],
        'encrypted-media': [],
        'fullscreen': ['self'],
        'picture-in-picture': []
      },
      crossOriginEmbedderPolicy: 'require-corp',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
      xDNSPrefetchControl: true,
      expectCT: {
        maxAge: 86400,
        enforce: true,
        reportUri: '/api/expect-ct-report'
      }
    });
  }

  /**
   * Create middleware for Next.js
   */
  static createMiddleware(isDevelopment: boolean = false) {
    return (req: unknown, res: unknown, next: () => void) => {
      const securityHeaders = isDevelopment 
        ? SecurityHeaders.createDevelopmentHeaders()
        : SecurityHeaders.createProductionHeaders();

      const headers = securityHeaders.generateHeaders();

      // Set all security headers
      const resObj = res as Record<string, unknown> & { setHeader?: (name: string, value: string) => void; removeHeader?: (name: string) => void };
      Object.entries(headers).forEach(([name, value]) => {
        resObj.setHeader?.(name, value);
      });

      // Additional security measures
      resObj.removeHeader?.('X-Powered-By'); // Remove server information
      resObj.setHeader?.('Server', 'NextJS'); // Generic server header

      next();
    };
  }

  /**
   * Validate security headers in response
   */
  static validateHeaders(headers: Record<string, string>): {
    isSecure: boolean;
    missing: string[];
    warnings: string[];
  } {
    const required = [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy'
    ];

    const recommended = [
      'Strict-Transport-Security',
      'Permissions-Policy',
      'Cross-Origin-Embedder-Policy',
      'Cross-Origin-Opener-Policy'
    ];

    const missing = required.filter(header => !headers[header]);
    const warnings = recommended.filter(header => !headers[header]);

    return {
      isSecure: missing.length === 0,
      missing,
      warnings
    };
  }
}

/**
 * Security headers audit utility
 */
export class SecurityHeadersAudit {
  /**
   * Audit security headers for a URL
   */
  static async auditURL(url: string): Promise<{
    url: string;
    headers: Record<string, string>;
    validation: ReturnType<typeof SecurityHeaders.validateHeaders>;
    score: number;
  }> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const headers: Record<string, string> = {};
      
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      const validation = SecurityHeaders.validateHeaders(headers);
      const score = this.calculateSecurityScore(headers);

      return {
        url,
        headers,
        validation,
        score
      };
    } catch (error) {
      throw new Error(`Failed to audit URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate security score based on headers
   */
  private static calculateSecurityScore(headers: Record<string, string>): number {
    const checks = [
      { header: 'content-security-policy', weight: 25 },
      { header: 'strict-transport-security', weight: 20 },
      { header: 'x-frame-options', weight: 15 },
      { header: 'x-content-type-options', weight: 10 },
      { header: 'referrer-policy', weight: 10 },
      { header: 'permissions-policy', weight: 10 },
      { header: 'cross-origin-embedder-policy', weight: 5 },
      { header: 'cross-origin-opener-policy', weight: 5 }
    ];

    let score = 0;
    checks.forEach(check => {
      if (headers[check.header]) {
        score += check.weight;
      }
    });

    return Math.min(score, 100);
  }
}

// Default security headers instance
export const securityHeaders = new SecurityHeaders();