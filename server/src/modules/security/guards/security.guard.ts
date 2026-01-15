import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { SecurityMonitoringService } from '../services/security-monitoring.service';
import { ThreatDetectionService } from '../services/threat-detection.service';
import { AuditService } from '../services/audit.service';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

export interface SecurityContext {
  user: AuthenticatedUser;
  request: any;
  ipAddress: string;
  userAgent: string;
  resource: string;
  action: string;
}

@Injectable()
export class SecurityGuard implements CanActivate {
  private readonly logger = new Logger(SecurityGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly securityMonitoringService: SecurityMonitoringService,
    private readonly threatDetectionService: ThreatDetectionService,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      return true; // Let AuthGuard handle authentication
    }

    const securityContext: SecurityContext = {
      user,
      request,
      ipAddress: this.getClientIp(request),
      userAgent: request.get('User-Agent') || 'unknown',
      resource: this.getResourceName(context),
      action: this.getActionName(context),
    };

    try {
      // Check for immediate security threats
      await this.checkImmediateThreats(securityContext);

      // Validate IP restrictions (for enterprise customers)
      await this.validateIpRestrictions(securityContext);

      // Check for suspicious activity patterns
      await this.checkSuspiciousActivity(securityContext);

      // Rate limiting check
      await this.checkRateLimit(securityContext);

      // Log security event
      await this.logSecurityEvent(securityContext);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Security check failed for user ${user.id}: ${errorMessage}`,
        errorStack,
      );

      // Log security violation
      await this.auditService.logEvent({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'security_violation',
        resource: securityContext.resource,
        ipAddress: securityContext.ipAddress,
        userAgent: securityContext.userAgent,
        metadata: {
          error: errorMessage,
          blocked: true,
        },
      });

      throw error;
    }
  }

  /**
   * Check for immediate security threats
   */
  private async checkImmediateThreats(context: SecurityContext): Promise<void> {
    const { user, ipAddress } = context;

    // Check if user account is compromised
    const isCompromised = await this.threatDetectionService.isAccountCompromised(
      user.tenantId,
      user.id,
    );

    if (isCompromised) {
      throw new ForbiddenException('Account security compromised - access denied');
    }

    // Check if IP is blacklisted
    const isBlacklisted = await this.threatDetectionService.isIpBlacklisted(ipAddress);
    if (isBlacklisted) {
      throw new ForbiddenException('Access denied from this IP address');
    }

    // Check for active security incidents
    const activeThreats = await this.securityMonitoringService.getActiveThreats(
      user.tenantId,
    );

    const criticalThreats = activeThreats.filter(
      threat => threat.severity === 'critical' && threat.status === 'active',
    );

    if (criticalThreats.length > 0) {
      // Allow only essential operations during critical security incidents
      const allowedActions = ['logout', 'security', 'audit'];
      if (!allowedActions.some(action => context.resource.includes(action))) {
        throw new ForbiddenException(
          'System in security lockdown - only essential operations allowed',
        );
      }
    }
  }

  /**
   * Validate IP restrictions for enterprise customers
   */
  private async validateIpRestrictions(context: SecurityContext): Promise<void> {
    const { user, ipAddress } = context;

    // Only apply IP restrictions for enterprise tier
    const businessTier = (user as any).businessTier;
    if (businessTier !== 'enterprise') {
      return;
    }

    // Get tenant IP whitelist (this would come from tenant settings)
    const allowedIps = await this.getTenantIpWhitelist(user.tenantId);
    
    if (allowedIps.length > 0) {
      const isAllowed = allowedIps.some(allowedIp => 
        this.isIpInRange(ipAddress, allowedIp),
      );

      if (!isAllowed) {
        throw new ForbiddenException(
          'Access denied - IP address not in whitelist',
        );
      }
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkSuspiciousActivity(context: SecurityContext): Promise<void> {
    const { user, ipAddress, userAgent } = context;

    // Check for unusual login patterns
    const recentLogins = await this.auditService.queryLogs({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'login',
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    });

    // Check for multiple IPs
    const uniqueIps = new Set(recentLogins.map(log => log.ipAddress));
    if (uniqueIps.size > 5) {
      this.logger.warn(
        `Suspicious activity: User ${user.id} logged in from ${uniqueIps.size} different IPs`,
      );
      
      // Don't block, but flag for monitoring
      await this.flagSuspiciousActivity(context, 'multiple_ips');
    }

    // Check for unusual user agent
    const commonUserAgents = recentLogins.map(log => log.userAgent);
    const isCommonUserAgent = commonUserAgents.includes(userAgent);
    
    if (!isCommonUserAgent && recentLogins.length > 0) {
      this.logger.warn(
        `Suspicious activity: User ${user.id} using new user agent: ${userAgent}`,
      );
      
      await this.flagSuspiciousActivity(context, 'new_user_agent');
    }
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(context: SecurityContext): Promise<void> {
    const { user, action } = context;

    // Different rate limits for different actions
    const rateLimits: Record<string, { requests: number; window: number }> = {
      login: { requests: 10, window: 5 * 60 * 1000 }, // 10 per 5 minutes
      export: { requests: 5, window: 60 * 60 * 1000 }, // 5 per hour
      api: { requests: 1000, window: 60 * 60 * 1000 }, // 1000 per hour
      default: { requests: 100, window: 60 * 1000 }, // 100 per minute
    };

    const limit = rateLimits[action] || rateLimits['default'];
    
    // Check recent requests
    const recentRequests = await this.auditService.queryLogs({
      tenantId: user.tenantId,
      userId: user.id,
      startDate: new Date(Date.now() - limit!.window),
    });

    if (recentRequests.length >= limit!.requests) {
      throw new ForbiddenException(
        `Rate limit exceeded - too many requests in time window`,
      );
    }
  }

  /**
   * Log security event for monitoring
   */
  private async logSecurityEvent(context: SecurityContext): Promise<void> {
    await this.auditService.logEvent({
      tenantId: context.user.tenantId,
      userId: context.user.id,
      action: 'security_check',
      resource: context.resource,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        passed: true,
        action: context.action,
      },
    });
  }

  /**
   * Flag suspicious activity for monitoring
   */
  private async flagSuspiciousActivity(
    context: SecurityContext,
    type: string,
  ): Promise<void> {
    await this.auditService.logEvent({
      tenantId: context.user.tenantId,
      userId: context.user.id,
      action: 'suspicious_activity',
      resource: context.resource,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        type,
        flagged: true,
        severity: 'medium',
      },
    });
  }

  /**
   * Get client IP address from request
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
   * Get resource name from execution context
   */
  private getResourceName(context: ExecutionContext): string {
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    return `${controller}.${handler}`;
  }

  /**
   * Get action name from execution context
   */
  private getActionName(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest();
    const method = (request.method as string).toLowerCase();
    const path = request.route?.path || request.url;
    
    // Map HTTP methods to actions
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
   * Get tenant IP whitelist (mock implementation)
   */
  private async getTenantIpWhitelist(tenantId: string): Promise<string[]> {
    // In a real implementation, this would query the database
    // For now, return empty array (no restrictions)
    return [];
  }

  /**
   * Check if IP is in allowed range
   */
  private isIpInRange(ip: string, range: string): boolean {
    // Simple implementation - in production, use a proper IP range library
    if (range.includes('/')) {
      // CIDR notation
      return false; // Simplified for now
    } else {
      // Exact match
      return ip === range;
    }
  }
}