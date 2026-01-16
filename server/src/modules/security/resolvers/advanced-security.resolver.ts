import { Resolver, Query, Mutation, Args, ID, Subscription } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { CacheInterceptor } from '../../../common/interceptors';
import { SecurityOrchestratorService } from '../services/security-orchestrator.service';
import {
  ThreatPattern,
  ThreatPatternMatch,
  BehavioralAnomaly,
  UserBehaviorProfile,
} from '../types/advanced-security.types';
import {
  AddThreatPatternInput,
  UpdateThreatPatternInput,
  BehavioralAnalysisFilterInput,
  CheckAccountCompromiseInput,
} from '../inputs/advanced-security.input';
import {
  ThreatAnalysis,
  ComplianceCheck,
  RateLimitSecurity,
  AuditRequired,
  EncryptionRequired,
} from '../decorators/advanced-security.decorator';

// Initialize PubSub using RedisPubSub for production or fallback to graphql-subscriptions
let pubSub: any;

try {
  // Try to use Redis-backed PubSub for production
  pubSub = new RedisPubSub();
} catch {
  // Fallback to in-memory PubSub for development
  const { PubSub } = require('graphql-subscriptions');
  pubSub = new PubSub();
}

/**
 * GraphQL resolver for advanced threat management
 * Provides comprehensive threat pattern management and behavioral analysis
 */
@Resolver(() => ThreatPattern)
@UseGuards(JwtAuthGuard)
export class ThreatManagementResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly securityOrchestrator: SecurityOrchestratorService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Get all threat patterns
   */
  @Query(() => [ThreatPattern], { name: 'threatPatterns' })
  @UseGuards(PermissionsGuard)
  @Permissions('threat:read')
  @UseInterceptors(CacheInterceptor)
  async getThreatPatterns(): Promise<ThreatPattern[]> {
    try {
      return await this.securityOrchestrator.getThreatPatterns();
    } catch (error) {
      this.handleError(error, 'Failed to fetch threat patterns');
      throw error;
    }
  }

  /**
   * Add new threat pattern
   */
  @Mutation(() => ThreatPattern, { name: 'addThreatPattern' })
  @UseGuards(PermissionsGuard)
  @Permissions('threat:admin')
  @AuditRequired('threat_pattern_created', 'security')
  @RateLimitSecurity(50)
  async addThreatPattern(
    @Args('input') input: AddThreatPatternInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ThreatPattern> {
    try {
      const pattern = {
        id: `pattern_${Date.now()}`,
        name: input.name,
        description: input.description,
        severity: input.severity,
        timeWindowMs: input.timeWindowMs,
        threshold: input.threshold,
        enabled: input.enabled !== false,
        conditions: input.conditions || [],
      };

      await this.securityOrchestrator.addThreatPattern(pattern);
      pubSub.publish('THREAT_PATTERN_ADDED', { threatPatternAdded: pattern });

      return pattern;
    } catch (error) {
      this.handleError(error, 'Failed to add threat pattern');
      throw error;
    }
  }

  /**
   * Remove threat pattern
   */
  @Mutation(() => Boolean, { name: 'removeThreatPattern' })
  @UseGuards(PermissionsGuard)
  @Permissions('threat:admin')
  @AuditRequired('threat_pattern_deleted', 'security')
  async removeThreatPattern(
    @Args('patternId', { type: () => ID }) patternId: string,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    try {
      await this.securityOrchestrator.removeThreatPattern(patternId);
      pubSub.publish('THREAT_PATTERN_REMOVED', { threatPatternRemoved: patternId });
      return true;
    } catch (error) {
      this.handleError(error, 'Failed to remove threat pattern');
      throw error;
    }
  }

  /**
   * Toggle threat pattern enable/disable
   */
  @Mutation(() => Boolean, { name: 'toggleThreatPattern' })
  @UseGuards(PermissionsGuard)
  @Permissions('threat:admin')
  @AuditRequired('threat_pattern_toggled', 'security')
  async toggleThreatPattern(
    @Args('patternId', { type: () => ID }) patternId: string,
    @Args('enabled') enabled: boolean,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    try {
      await this.securityOrchestrator.toggleThreatPattern(patternId, enabled);
      pubSub.publish('THREAT_PATTERN_TOGGLED', { patternId, enabled });
      return true;
    } catch (error) {
      this.handleError(error, 'Failed to toggle threat pattern');
      throw error;
    }
  }

  /**
   * Subscribe to threat pattern changes
   */
  @Subscription(() => ThreatPattern, { name: 'threatPatternAdded' })
  threatPatternAdded() {
    return pubSub.asyncIterator(['THREAT_PATTERN_ADDED']);
  }
}

/**
 * GraphQL resolver for behavioral analysis
 * Provides user behavior profiling and anomaly detection
 */
@Resolver(() => UserBehaviorProfile)
@UseGuards(JwtAuthGuard)
export class BehavioralAnalysisResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly securityOrchestrator: SecurityOrchestratorService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Perform behavioral analysis on user
   */
  @Query(() => [BehavioralAnomaly], { name: 'userBehavioralAnalysis' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  @ThreatAnalysis('high')
  @UseInterceptors(CacheInterceptor)
  async performBehavioralAnalysis(
    @Args('filter') filter: BehavioralAnalysisFilterInput,
    @CurrentTenant() tenantId: string,
  ): Promise<BehavioralAnomaly[]> {
    try {
      const analyses = await this.securityOrchestrator.performBehavioralAnalysis(
        filter.userId,
        tenantId,
      );

      return analyses.map((analysis: any) => ({
        id: `anomaly_${Date.now()}`,
        userId: filter.userId,
        tenantId,
        type: analysis.type,
        description: analysis.description,
        severity: analysis.severity,
        confidence: analysis.confidence,
        detectedAt: new Date(),
        metadata: analysis.metadata,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to perform behavioral analysis');
      throw error;
    }
  }

  /**
   * Check if account is compromised
   */
  @Query(() => Boolean, { name: 'checkAccountCompromise' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  @ThreatAnalysis('critical')
  @AuditRequired('account_compromise_check', 'security')
  async checkAccountCompromise(
    @Args('input') input: CheckAccountCompromiseInput,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    try {
      const isCompromised = await this.securityOrchestrator.checkAccountCompromise(
        tenantId,
        input.userId,
      );

      if (isCompromised) {
        pubSub.publish('ACCOUNT_COMPROMISED', {
          accountCompromised: { userId: input.userId, tenantId },
        });
      }

      return isCompromised;
    } catch (error) {
      this.handleError(error, 'Failed to check account compromise');
      throw error;
    }
  }

  /**
   * Subscribe to account compromise alerts
   */
  @Subscription(() => Object, { name: 'accountCompromised' })
  accountCompromised() {
    return pubSub.asyncIterator(['ACCOUNT_COMPROMISED']);
  }
}

/**
 * GraphQL resolver for audit analysis and reporting
 * Provides comprehensive audit trail analysis and reporting
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class AuditAnalysisResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly securityOrchestrator: SecurityOrchestratorService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Generate comprehensive audit report
   */
  @Query(() => Object, { name: 'generateAuditReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('audit:read')
  @AuditRequired('audit_report_generated', 'compliance')
  @ComplianceCheck()
  async generateAuditReport(
    @Args('startDate', { type: () => Date }) startDate: Date,
    @Args('endDate', { type: () => Date }) endDate: Date,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    try {
      return await this.securityOrchestrator.generateAuditReport(tenantId, startDate, endDate);
    } catch (error) {
      this.handleError(error, 'Failed to generate audit report');
      throw error;
    }
  }

  /**
   * Analyze audit patterns for anomalies
   */
  @Query(() => Object, { name: 'auditPatternAnalysis' })
  @UseGuards(PermissionsGuard)
  @Permissions('audit:read')
  @UseInterceptors(CacheInterceptor)
  async analyzeAuditPatterns(
    @Args('timeWindowDays', { type: () => Number, nullable: true }) timeWindowDays: number,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    try {
      return await this.securityOrchestrator.analyzeAuditPatterns(
        tenantId,
        timeWindowDays || 30,
      );
    } catch (error) {
      this.handleError(error, 'Failed to analyze audit patterns');
      throw error;
    }
  }
}

/**
 * GraphQL resolver for encryption and key management
 * Provides encryption operations and key lifecycle management
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class EncryptionManagementResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly securityOrchestrator: SecurityOrchestratorService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Mask sensitive data
   */
  @Query(() => Object, { name: 'maskSensitiveData' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  @EncryptionRequired()
  async maskSensitiveData(
    @Args('data', { type: () => String }) data: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    try {
      const parsed = JSON.parse(data);
      return this.securityOrchestrator.maskSensitiveData(parsed);
    } catch (error) {
      this.handleError(error, 'Failed to mask sensitive data');
      throw error;
    }
  }

  /**
   * Hash password securely
   */
  @Query(() => String, { name: 'hashPassword' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:admin')
  @AuditRequired('password_hashed', 'security')
  @EncryptionRequired()
  async hashPassword(
    @Args('password', { type: () => String }) password: string,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      return await this.securityOrchestrator.hashPassword(password);
    } catch (error) {
      this.handleError(error, 'Failed to hash password');
      throw error;
    }
  }

  /**
   * Verify password hash
   */
  @Query(() => Boolean, { name: 'verifyPassword' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:admin')
  @ThreatAnalysis('high')
  async verifyPassword(
    @Args('password', { type: () => String }) password: string,
    @Args('hash', { type: () => String }) hash: string,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    try {
      return await this.securityOrchestrator.verifyPassword(password, hash);
    } catch (error) {
      this.handleError(error, 'Failed to verify password');
      throw error;
    }
  }
}

/**
 * GraphQL resolver for real-time security monitoring
 * Provides live security event streaming and alerts
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class SecurityMonitoringResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly securityOrchestrator: SecurityOrchestratorService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Subscribe to active threats
   */
  @Subscription(() => Object, { name: 'activeThreatsUpdated' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  activeThreatsUpdated(@CurrentTenant() tenantId: string) {
    return pubSub.asyncIterator(['ACTIVE_THREATS_UPDATED']);
  }

  /**
   * Subscribe to security alerts
   */
  @Subscription(() => Object, { name: 'securityAlertReceived' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  securityAlertReceived(@CurrentTenant() tenantId: string) {
    return pubSub.asyncIterator(['SECURITY_ALERT']);
  }

  /**
   * Subscribe to compliance violations
   */
  @Subscription(() => Object, { name: 'complianceViolationDetected' })
  @UseGuards(PermissionsGuard)
  @Permissions('compliance:read')
  complianceViolationDetected(@CurrentTenant() tenantId: string) {
    return pubSub.asyncIterator(['COMPLIANCE_VIOLATION']);
  }
}
