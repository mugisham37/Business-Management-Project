/**
 * CSRF Protection Utilities
 * Prevents Cross-Site Request Forgery attacks through token validation
 * Requirements: 12.2
 */

import { randomBytes, createHash } from 'crypto';

export interface CSRFConfig {
  tokenLength: number;
  cookieName: string;
  headerName: string;
  sessionKey: string;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number; // in seconds
}

export interface CSRFToken {
  token: string;
  hash: string;
  expiresAt: Date;
}

export class CSRFProtector {
  private config: CSRFConfig;
  private tokens: Map<string, CSRFToken> = new Map();

  constructor(config: Partial<CSRFConfig> = {}) {
    this.config = {
      tokenLength: 32,
      cookieName: 'csrf-token',
      headerName: 'X-CSRF-Token',
      sessionKey: 'csrf-session',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600, // 1 hour
      ...config
    };
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(sessionId: string): CSRFToken {
    const token = randomBytes(this.config.tokenLength).toString('hex');
    const hash = this.hashToken(token, sessionId);
    const expiresAt = new Date(Date.now() + this.config.maxAge * 1000);

    const csrfToken: CSRFToken = {
      token,
      hash,
      expiresAt
    };

    // Store token for validation
    this.tokens.set(sessionId, csrfToken);

    // Clean up expired tokens
    this.cleanupExpiredTokens();

    return csrfToken;
  }

  /**
   * Validate CSRF token
   */
  validateToken(token: string, sessionId: string): boolean {
    const storedToken = this.tokens.get(sessionId);
    
    if (!storedToken) {
      return false;
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      this.tokens.delete(sessionId);
      return false;
    }

    // Validate token hash
    const expectedHash = this.hashToken(token, sessionId);
    const isValid = this.constantTimeCompare(storedToken.hash, expectedHash);

    return isValid;
  }

  /**
   * Get CSRF token for session
   */
  getToken(sessionId: string): CSRFToken | null {
    const token = this.tokens.get(sessionId);
    
    if (!token || new Date() > token.expiresAt) {
      return null;
    }

    return token;
  }

  /**
   * Invalidate CSRF token
   */
  invalidateToken(sessionId: string): void {
    this.tokens.delete(sessionId);
  }

  /**
   * Create CSRF middleware for Next.js API routes
   */
  createMiddleware() {
    return async (req: unknown, res: unknown, next: () => void) => {
      const reqObj = req as Record<string, unknown>;
      const resObj = res as Record<string, unknown> & { status?: (code: number) => { json?: (data: unknown) => unknown } };
      const method = reqObj?.method?.toString().toLowerCase();
      
      // Skip CSRF validation for safe methods
      if (['get', 'head', 'options'].includes(method ?? '')) {
        return next();
      }

      const sessionId = this.getSessionId(req);
      if (!sessionId) {
        return resObj.status?.(403).json?.({ error: 'No session found' });
      }

      // Get token from header or body
      const headerName = this.config.headerName.toLowerCase();
      const headers = (reqObj.headers as Record<string, unknown>) || {};
      const token = headers[headerName] || 
                   (reqObj.body as Record<string, unknown>)?.csrfToken;

      if (!token) {
        return resObj.status?.(403).json?.({ error: 'CSRF token missing' });
      }

      if (!this.validateToken(token as string, sessionId)) {
        return resObj.status?.(403).json?.({ error: 'Invalid CSRF token' });
      }

      return next();
    };
  }

  /**
   * Generate CSRF token for forms
   */
  getTokenForForm(sessionId: string): string {
    let token = this.getToken(sessionId);
    
    if (!token) {
      token = this.generateToken(sessionId);
    }

    return token.token;
  }

  /**
   * Create CSRF meta tags for HTML head
   */
  getMetaTags(sessionId: string): string {
    const token = this.getTokenForForm(sessionId);
    
    return `
      <meta name="csrf-token" content="${token}">
      <meta name="csrf-header" content="${this.config.headerName}">
    `;
  }

  private hashToken(token: string, sessionId: string): string {
    return createHash('sha256')
      .update(token + sessionId + process.env.CSRF_SECRET || 'default-secret')
      .digest('hex');
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  private getSessionId(req: unknown): string | null {
    // Try to get session ID from various sources
    const reqObj = req as Record<string, unknown>;
    const headerName = 'x-session-id';
    const headers = reqObj.headers as Record<string, unknown> | undefined;
    return (reqObj.session as Record<string, unknown>)?.id as string || 
           (reqObj.cookies as Record<string, unknown>)?.sessionId as string || 
           headers?.[headerName] as string ||
           null;
  }

  private cleanupExpiredTokens(): void {
    const now = new Date();
    
    for (const [sessionId, token] of this.tokens.entries()) {
      if (now > token.expiresAt) {
        this.tokens.delete(sessionId);
      }
    }
  }
}

// Default CSRF protector instance
export const csrfProtector = new CSRFProtector();

/**
 * React hook for CSRF protection
 */
export function useCSRFProtection() {
  const getToken = (sessionId: string) => csrfProtector.getTokenForForm(sessionId);
  
  const validateRequest = async (token: string, sessionId: string) => {
    return csrfProtector.validateToken(token, sessionId);
  };

  const addTokenToHeaders = (headers: Record<string, string>, sessionId: string) => {
    const token = csrfProtector.getTokenForForm(sessionId);
    return {
      ...headers,
      'X-CSRF-Token': token
    };
  };

  return {
    getToken,
    validateRequest,
    addTokenToHeaders
  };
}

/**
 * Utility to add CSRF token to GraphQL requests
 */
export function addCSRFToGraphQLRequest(
  request: unknown, 
  sessionId: string
): Record<string, unknown> {
  const token = csrfProtector.getTokenForForm(sessionId);
  const reqObj = request as Record<string, unknown>;
  const contextObj = reqObj.context as Record<string, unknown>;
  
  return {
    ...reqObj,
    context: {
      ...contextObj,
      headers: {
        ...(contextObj?.headers as Record<string, unknown>),
        'X-CSRF-Token': token
      }
    }
  };
}