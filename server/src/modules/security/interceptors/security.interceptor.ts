import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';

import { EncryptionService } from '../services/encryption.service';
import { AuditService } from '../services/audit.service';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityInterceptor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user: AuthenticatedUser = request.user;

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // Add security headers
    this.addSecurityHeaders(response);

    // Mask sensitive data in request body for logging
    const maskedRequestBody = this.maskSensitiveData(request.body);

    // Log request start
    this.logger.debug(
      `Security intercept start: ${request.method} ${request.url}`,
      {
        requestId,
        userId: user?.id,
        tenantId: user?.tenantId,
        body: maskedRequestBody,
      },
    );

    return next.handle().pipe(
      tap(async (data) => {
        const duration = Date.now() - startTime;

        // Mask sensitive data in response for logging
        const maskedResponseData = this.maskSensitiveData(data);

        // Log successful request
        this.logger.debug(
          `Security intercept success: ${request.method} ${request.url} - ${duration}ms`,
          {
            requestId,
            userId: user?.id,
            tenantId: user?.tenantId,
            duration,
            response: maskedResponseData,
          },
        );

        // Audit security-sensitive operations
        if (this.isSecuritySensitiveOperation(request)) {
          await this.auditSecurityOperation(request, user, data, 'success');
        }
      }),
      catchError(async (error) => {
        const duration = Date.now() - startTime;

        // Log error
        this.logger.error(
          `Security intercept error: ${request.method} ${request.url} - ${duration}ms`,
          {
            requestId,
            userId: user?.id,
            tenantId: user?.tenantId,
            duration,
            error: error.message,
            stack: error.stack,
          },
        );

        // Audit failed security operations
        if (this.isSecuritySensitiveOperation(request)) {
          await this.auditSecurityOperation(request, user, null, 'error', error);
        }

        throw error;
      }),
    );
  }

  /**
   * Add security headers to response
   */
  private addSecurityHeaders(response: any): void {
    // Prevent clickjacking
    response.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    response.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    response.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Enforce HTTPS
    response.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
    
    // Content Security Policy
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';",
    );
    
    // Referrer Policy
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );

    // Remove server information
    response.removeHeader('X-Powered-By');
  }

  /**
   * Mask sensitive data for logging
   */
  private maskSensitiveData(data: any): any {
    if (!data) return data;

    return this.encryptionService.maskSensitiveData(data, [
      // Additional fields to mask beyond defaults
      'creditCardNumber',
      'cvv',
      'bankAccountNumber',
      'routingNumber',
      'taxId',
      'socialSecurityNumber',
      'driverLicenseNumber',
      'passportNumber',
    ]);
  }

  /**
   * Check if operation is security-sensitive
   */
  private isSecuritySensitiveOperation(request: any): boolean {
    const securitySensitivePaths = [
      '/auth/',
      '/security/',
      '/admin/',
      '/users/',
      '/permissions/',
      '/roles/',
      '/api-keys/',
      '/encryption/',
      '/audit/',
    ];

    const securitySensitiveActions = [
      'login',
      'logout',
      'register',
      'password',
      'permission',
      'role',
      'encrypt',
      'decrypt',
      'key',
    ];

    const path = request.url.toLowerCase();
    const body = JSON.stringify(request.body || {}).toLowerCase();

    return (
      securitySensitivePaths.some(sensitivePath => path.includes(sensitivePath)) ||
      securitySensitiveActions.some(action => path.includes(action) || body.includes(action))
    );
  }

  /**
   * Audit security-sensitive operations
   */
  private async auditSecurityOperation(
    request: any,
    user: AuthenticatedUser | undefined,
    responseData: any,
    status: 'success' | 'error',
    error?: Error,
  ): Promise<void> {
    try {
      const auditData = {
        tenantId: user?.tenantId || 'system',
        userId: user?.id || 'anonymous',
        action: this.getActionFromRequest(request),
        resource: this.getResourceFromRequest(request),
        ipAddress: this.getClientIp(request),
        userAgent: request.get('User-Agent') || 'unknown',
        metadata: {
          method: request.method,
          url: request.url,
          status,
          requestBody: this.maskSensitiveData(request.body),
          responseData: status === 'success' ? this.maskSensitiveData(responseData) : null,
          error: error ? {
            message: error.message,
            name: error.name,
          } : null,
          timestamp: new Date().toISOString(),
        },
      };

      await this.auditService.logEvent(auditData);
    } catch (auditError) {
      const auditErrorMessage = auditError instanceof Error ? auditError.message : String(auditError);
      const auditErrorStack = auditError instanceof Error ? auditError.stack : undefined;
      this.logger.error(
        `Failed to audit security operation: ${auditErrorMessage}`,
        auditErrorStack,
      );
    }
  }

  /**
   * Extract action from request
   */
  private getActionFromRequest(request: any): string {
    const method = request.method.toLowerCase();
    const path = request.url.toLowerCase();

    // Map specific paths to actions
    if (path.includes('login')) return 'login';
    if (path.includes('logout')) return 'logout';
    if (path.includes('register')) return 'register';
    if (path.includes('encrypt')) return 'encrypt';
    if (path.includes('decrypt')) return 'decrypt';
    if (path.includes('password')) return 'password_change';
    if (path.includes('permission')) return 'permission_change';
    if (path.includes('role')) return 'role_change';

    // Default HTTP method mapping
    const actionMap: Record<string, string> = {
      get: 'read',
      post: 'create',
      put: 'update',
      patch: 'update',
      delete: 'delete',
    };

    return actionMap[method] || method;
  }

  /**
   * Extract resource from request
   */
  private getResourceFromRequest(request: any): string {
    const path = request.url;
    
    // Remove query parameters and extract resource
    const cleanPath = path.split('?')[0];
    const pathParts = cleanPath.split('/').filter((part: string) => part);
    
    // Return the main resource (usually the second part after 'api/v1')
    if (pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'v1') {
      return pathParts[2];
    }
    
    return cleanPath;
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}