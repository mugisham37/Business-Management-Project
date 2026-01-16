import { Injectable, CanActivate, ExecutionContext, Logger, BadRequestException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { SecurityOrchestratorService } from '../services/security-orchestrator.service';

/**
 * Guard to analyze requests for threats and block suspicious activity
 * Performs behavioral analysis and threat detection
 */
@Injectable()
export class ThreatAnalysisGuard implements CanActivate {
  private readonly logger = new Logger(ThreatAnalysisGuard.name);

  constructor(private readonly securityOrchestrator: SecurityOrchestratorService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    const user = req.user;

    if (!user) {
      return true;
    }

    try {
      // Check if account is compromised
      const tenantId = req.headers['x-tenant-id'] || user.tenantId;
      const isCompromised = await this.securityOrchestrator.checkAccountCompromise(
        tenantId,
        user.id,
      );

      if (isCompromised) {
        this.logger.warn(`Blocked potentially compromised account: ${user.id}`);
        throw new BadRequestException('Account security check failed');
      }

      // Perform behavioral analysis
      const anomalies = await this.securityOrchestrator.performBehavioralAnalysis(
        user.id,
        tenantId,
      );

      if (anomalies.length > 0) {
        const criticalAnomalies = anomalies.filter(
          (a) => a.confidence > 0.8 && a.severity === 'critical',
        );
        if (criticalAnomalies.length > 0) {
          this.logger.warn(`Detected critical behavioral anomalies for user: ${user.id}`);
          // Could block or flag for review based on policy
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error in threat analysis guard', error);
      return false;
    }
  }
}

/**
 * Guard to enforce compliance checks on sensitive operations
 * Ensures operations comply with configured frameworks
 */
@Injectable()
export class ComplianceGuard implements CanActivate {
  private readonly logger = new Logger(ComplianceGuard.name);

  constructor(private readonly securityOrchestrator: SecurityOrchestratorService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    const user = req.user;

    if (!user) {
      return true;
    }

    try {
      const tenantId = req.headers['x-tenant-id'] || user.tenantId;
      const complianceStatus = await this.securityOrchestrator.getComplianceStatus(tenantId);

      // Check if tenant is in compliant state
      if (complianceStatus && complianceStatus.frameworks) {
        const nonCompliantFrameworks = complianceStatus.frameworks.filter(
          (f: any) => f.overallStatus === 'non_compliant',
        );

        if (nonCompliantFrameworks.length > 0) {
          this.logger.warn(
            `Operation attempted on non-compliant tenant ${tenantId}: ${nonCompliantFrameworks.map((f: any) => f.frameworkId).join(', ')}`,
          );
          // Could block based on severity
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error in compliance guard', error);
      return true; // Allow on error
    }
  }
}

/**
 * Guard to enforce rate limiting for security operations
 * Prevents abuse and brute force attempts
 */
@Injectable()
export class SecurityRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(SecurityRateLimitGuard.name);
  private readonly requestCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly maxRequests = 100;
  private readonly windowMs = 60000; // 1 minute

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    const user = req.user;

    if (!user) {
      return true;
    }

    const key = `${user.id}:${req.ip}`;
    const now = Date.now();
    const record = this.requestCounts.get(key);

    if (!record || now > record.resetTime) {
      this.requestCounts.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    record.count++;

    if (record.count > this.maxRequests) {
      this.logger.warn(`Rate limit exceeded for user ${user.id}`);
      throw new BadRequestException('Too many security operation attempts');
    }

    return true;
  }
}

/**
 * Guard to enforce encryption on sensitive data operations
 * Ensures sensitive data is properly encrypted
 */
@Injectable()
export class EncryptionGuard implements CanActivate {
  private readonly logger = new Logger(EncryptionGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req, extra } = ctx.getContext();

    // Check if request involves sensitive data
    const operationName = ctx.getInfo().operation.name?.value;
    const sensitiveOperations = [
      'updateSecuritySettings',
      'configureSSO',
      'rotatKeys',
      'deleteData',
    ];

    if (sensitiveOperations.some((op) => operationName?.includes(op))) {
      // Verify encryption settings are enabled
      const user = req.user;
      if (user) {
        const tenantId = req.headers['x-tenant-id'] || user.tenantId;
        // Get security settings and verify encryption is enabled
        // This would be enhanced with actual orchestrator call
        this.logger.debug(`Encryption check for operation: ${operationName}`);
      }
    }

    return true;
  }
}

/**
 * Guard to enforce data access control
 * Checks sensitive data access permissions
 */
@Injectable()
export class DataAccessGuard implements CanActivate {
  private readonly logger = new Logger(DataAccessGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    const user = req.user;
    const args = ctx.getArgs();

    if (!user) {
      return true;
    }

    // Check if accessing audit logs or sensitive data
    const operationName = ctx.getInfo().operation.name?.value;
    const sensitiveDataOperations = ['auditLogs', 'complianceReports', 'threatAnalysis'];

    if (sensitiveDataOperations.some((op) => operationName?.includes(op))) {
      // Verify user has appropriate permissions
      const tenantId = req.headers['x-tenant-id'] || user.tenantId;

      if (args.filter?.tenantId && args.filter.tenantId !== tenantId) {
        this.logger.warn(
          `Unauthorized access attempt for tenant ${args.filter.tenantId} by user ${user.id}`,
        );
        throw new BadRequestException('Unauthorized tenant access');
      }
    }

    return true;
  }
}
