import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ThreatDetectionService } from '../services/threat-detection.service';
import { SecurityMonitoringService } from '../services/security-monitoring.service';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Injectable()
export class ThreatDetectionGuard implements CanActivate {
  private readonly logger = new Logger(ThreatDetectionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly threatDetectionService: ThreatDetectionService,
    private readonly securityMonitoringService: SecurityMonitoringService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      return true; // Let AuthGuard handle authentication
    }

    try {
      // Check if threat detection is enabled for this endpoint
      const enableThreatDetection = this.reflector.get<boolean>(
        'enableThreatDetection',
        context.getHandler(),
      ) ?? true; // Default to enabled

      if (!enableThreatDetection) {
        return true;
      }

      // Perform real-time threat analysis
      const threatAnalyses = await this.performRealTimeThreatAnalysis(request, user);

      // Check for high-risk threats
      const highRiskThreats = threatAnalyses.filter(
        analysis => analysis.riskScore >= 75 && analysis.confidence >= 80,
      );

      if (highRiskThreats.length > 0) {
        this.logger.warn(
          `High-risk threat detected for user ${user.id}: ${highRiskThreats.map(t => t.threatId).join(', ')}`,
        );

        // Block request for critical threats
        const criticalThreats = highRiskThreats.filter(t => t.riskScore >= 90);
        if (criticalThreats.length > 0) {
          throw new ForbiddenException({
            message: 'Request blocked due to security threat detection',
            threatIds: criticalThreats.map(t => t.threatId),
            riskScore: Math.max(...criticalThreats.map(t => t.riskScore)),
          });
        }

        // Log medium-risk threats but allow request
        await this.logThreatDetection(user, highRiskThreats, 'allowed');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Threat detection guard error for user ${user.id}: ${errorMessage}`,
        errorStack,
      );

      // In case of error, allow request but log the issue
      return true;
    }
  }

  /**
   * Perform real-time threat analysis on the current request
   */
  private async performRealTimeThreatAnalysis(
    request: any,
    user: AuthenticatedUser,
  ): Promise<any[]> {
    const requestEvent = {
      tenantId: user.tenantId,
      userId: user.id,
      action: this.getActionFromRequest(request),
      resource: this.getResourceFromRequest(request),
      ipAddress: this.getClientIp(request),
      userAgent: request.get('User-Agent') || 'unknown',
      timestamp: new Date(),
      metadata: {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
        realTime: true,
      },
    };

    // Analyze the event for threats
    const analyses = await this.threatDetectionService.analyzeEvent(requestEvent);

    // Perform additional behavioral analysis
    const behavioralAnalyses = await this.threatDetectionService.performBehavioralAnalysis(
      user.id,
      user.tenantId,
    );

    return [...analyses, ...behavioralAnalyses];
  }

  /**
   * Log threat detection results
   */
  private async logThreatDetection(
    user: AuthenticatedUser,
    threats: any[],
    action: 'blocked' | 'allowed',
  ): Promise<void> {
    const logData = {
      userId: user.id,
      tenantId: user.tenantId,
      action: 'threat_detection',
      threats: threats.map(t => ({
        threatId: t.threatId,
        riskScore: t.riskScore,
        confidence: t.confidence,
        indicators: t.indicators,
      })),
      actionTaken: action,
      timestamp: new Date(),
    };

    // This would typically log to the audit service
    this.logger.log(`Threat detection: ${action} - ${JSON.stringify(logData)}`);
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
    if (path.includes('export')) return 'export';
    if (path.includes('download')) return 'download';

    // Default HTTP method mapping
    const actionMap: Record<string, string> = {
      get: 'read',
      post: 'create',
      put: 'update',
      patch: 'update',
      delete: 'delete',
    };

    return actionMap[method.toLowerCase()] ?? method;
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
   * Sanitize headers for logging (remove sensitive information)
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}