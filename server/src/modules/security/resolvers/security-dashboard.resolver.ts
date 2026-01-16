import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { CacheInterceptor } from '../../../common/interceptors';
import { SecurityMonitoringService } from '../services/security-monitoring.service';
import { ThreatDetectionService } from '../services/threat-detection.service';
import { 
  SecurityDashboard, 
  SecurityMetrics, 
  ThreatAnalysis, 
  AccessPattern 
} from '../types/security.types';
import { 
  SecurityMetricsFilterInput, 
  ThreatAnalysisFilterInput, 
  AccessPatternFilterInput 
} from '../inputs/security.input';

/**
 * GraphQL resolver for security dashboards
 * Provides queries for security metrics, threat analysis, and access patterns
 * Implements caching with 5-minute TTL for performance
 */
@Resolver()
@UseGuards(JwtAuthGuard)
@UseInterceptors(CacheInterceptor)
export class SecurityDashboardResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly securityMonitoringService: SecurityMonitoringService,
    private readonly threatDetectionService: ThreatDetectionService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Get security dashboard for the current tenant
   * Cached for 5 minutes
   */
  @Query(() => SecurityDashboard, { name: 'securityDashboard' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  async getSecurityDashboard(
    @CurrentTenant() tenantId: string,
  ): Promise<SecurityDashboard> {
    try {
      // Get current security metrics
      const metrics = await this.securityMonitoringService.getCurrentMetrics(tenantId);

      // Get recent threats
      const threats = await this.threatDetectionService.getActiveThreats(tenantId, 10);

      // Get recent security events
      const events = await this.securityMonitoringService.getRecentEvents(tenantId, 20);

      return {
        tenantId,
        timestamp: new Date(),
        threatLevel: metrics.threatLevel || 'low',
        activeThreats: threats.length,
        failedLogins: metrics.failedLogins || 0,
        successfulLogins: metrics.successfulLogins || 0,
        dataAccessAttempts: metrics.dataAccessAttempts || 0,
        suspiciousActivities: metrics.suspiciousActivities || 0,
        recentThreats: threats.map((threat: any) => ({
          id: threat.id,
          type: threat.type,
          severity: threat.severity,
          description: threat.description,
          source: threat.source,
          firstDetected: threat.firstDetected,
          lastSeen: threat.lastSeen,
          count: threat.count,
          status: threat.status,
          affectedResources: threat.affectedResources,
          recommendedActions: threat.recommendedActions,
        })),
        recentEvents: events.map(event => ({
          id: event.id,
          tenantId: event.tenantId,
          type: event.type,
          description: event.description,
          severity: event.severity,
          timestamp: event.timestamp,
          userId: event.userId,
          resource: event.resource,
          resourceId: event.resourceId,
          ipAddress: event.ipAddress,
          metadata: event.metadata,
          investigated: event.investigated || false,
          investigatedBy: event.investigatedBy,
          investigatedAt: event.investigatedAt,
          resolution: event.resolution,
        })),
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch security dashboard');
      throw error;
    }
  }

  /**
   * Get security metrics for a specific period
   * Cached for 5 minutes
   */
  @Query(() => SecurityMetrics, { name: 'securityMetrics' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  async getSecurityMetrics(
    @Args('filter', { type: () => SecurityMetricsFilterInput, nullable: true }) filter: SecurityMetricsFilterInput,
    @CurrentTenant() tenantId: string,
  ): Promise<SecurityMetrics> {
    try {
      const period = filter?.period || 'day';
      const startDate = filter?.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = filter?.endDate || new Date();

      const metrics = await this.securityMonitoringService.getMetrics(tenantId, {
        period,
        startDate,
        endDate,
      });

      return {
        tenantId,
        period,
        startDate,
        endDate,
        totalEvents: metrics.totalEvents || 0,
        criticalEvents: metrics.criticalEvents || 0,
        highSeverityEvents: metrics.highSeverityEvents || 0,
        mediumSeverityEvents: metrics.mediumSeverityEvents || 0,
        lowSeverityEvents: metrics.lowSeverityEvents || 0,
        failedLoginAttempts: metrics.failedLoginAttempts || 0,
        successfulLogins: metrics.successfulLogins || 0,
        dataAccessEvents: metrics.dataAccessEvents || 0,
        configurationChanges: metrics.configurationChanges || 0,
        threatsDetected: metrics.threatsDetected || 0,
        threatsResolved: metrics.threatsResolved || 0,
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch security metrics');
      throw error;
    }
  }

  /**
   * Get threat analysis for a specific period
   * Cached for 5 minutes
   */
  @Query(() => ThreatAnalysis, { name: 'threatAnalysis' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  async getThreatAnalysis(
    @Args('filter', { type: () => ThreatAnalysisFilterInput, nullable: true }) filter: ThreatAnalysisFilterInput,
    @CurrentTenant() tenantId: string,
  ): Promise<ThreatAnalysis> {
    try {
      const period = filter?.period || 'week';
      const startDate = filter?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = filter?.endDate || new Date();

      const analysis = await this.threatDetectionService.analyzeThreat(tenantId, {
        period,
        startDate,
        endDate,
        minSeverity: filter?.minSeverity,
        status: filter?.status,
      });

      return {
        tenantId,
        period,
        startDate,
        endDate,
        totalThreats: analysis.totalThreats || 0,
        activeThreats: analysis.activeThreats || 0,
        resolvedThreats: analysis.resolvedThreats || 0,
        topThreatTypes: analysis.topThreatTypes || [],
        topTargetedResources: analysis.topTargetedResources || [],
        topSourceIPs: analysis.topSourceIPs || [],
        averageResolutionTime: analysis.averageResolutionTime || 0,
        criticalThreats: (analysis.criticalThreats || []).map((threat: any) => ({
          id: threat.id,
          type: threat.type,
          severity: threat.severity,
          description: threat.description,
          source: threat.source,
          firstDetected: threat.firstDetected,
          lastSeen: threat.lastSeen,
          count: threat.count,
          status: threat.status,
          affectedResources: threat.affectedResources,
          recommendedActions: threat.recommendedActions,
        })),
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch threat analysis');
      throw error;
    }
  }

  /**
   * Get access patterns for a specific user
   * Cached for 5 minutes
   */
  @Query(() => AccessPattern, { name: 'accessPatterns' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  async getAccessPatterns(
    @Args('filter') filter: AccessPatternFilterInput,
    @CurrentTenant() tenantId: string,
  ): Promise<AccessPattern> {
    try {
      const period = filter.period || 'week';
      const startDate = filter.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = filter.endDate || new Date();

      const patterns = await this.securityMonitoringService.getAccessPatterns(
        tenantId,
        filter.userId,
        {
          period,
          startDate,
          endDate,
        },
      );

      return {
        userId: filter.userId,
        tenantId,
        period,
        totalAccesses: patterns.totalAccesses || 0,
        uniqueResources: patterns.uniqueResources || 0,
        mostAccessedResources: patterns.mostAccessedResources || [],
        accessTimes: patterns.accessTimes || [],
        accessLocations: patterns.accessLocations || [],
        suspiciousActivityScore: patterns.suspiciousActivityScore || 0,
        anomalies: patterns.anomalies || [],
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch access patterns');
      throw error;
    }
  }

  /**
   * Get security trends over time
   * Cached for 5 minutes
   */
  @Query(() => Object, { name: 'securityTrends' })
  @UseGuards(PermissionsGuard)
  @Permissions('security:read')
  async getSecurityTrends(
    @Args('period', { type: () => String, defaultValue: 'month' }) period: string,
    @Args('startDate', { type: () => Date, nullable: true }) startDate: Date,
    @Args('endDate', { type: () => Date, nullable: true }) endDate: Date,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const trends = await this.securityMonitoringService.getTrends(tenantId, {
        period,
        startDate: start,
        endDate: end,
      });

      return {
        tenantId,
        period,
        startDate: start,
        endDate: end,
        dataPoints: trends.dataPoints || [],
        threatLevelTrend: trends.threatLevelTrend || 'stable',
        eventVolumeTrend: trends.eventVolumeTrend || 'stable',
        recommendations: trends.recommendations || [],
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch security trends');
      throw error;
    }
  }
}
