import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { AuditService } from '../services/audit.service';
import { AuditLog } from '../types/security.types';
import { AuditLogFilterInput, ExportAuditLogsInput } from '../inputs/security.input';

/**
 * GraphQL resolver for audit log management
 * Provides read-only access to audit logs with strict permission controls
 * Prevents log tampering by design
 */
@Resolver(() => AuditLog)
@UseGuards(JwtAuthGuard)
export class AuditResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly auditService: AuditService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Get audit logs with optional filtering
   * Read-only operation with strict permission controls
   */
  @Query(() => [AuditLog], { name: 'auditLogs' })
  @UseGuards(PermissionsGuard)
  @Permissions('audit:read')
  async getAuditLogs(
    @Args('filter', { type: () => AuditLogFilterInput, nullable: true }) filter: AuditLogFilterInput,
    @CurrentTenant() tenantId: string,
  ): Promise<AuditLog[]> {
    try {
      // Build date range
      const startDate = filter?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = filter?.endDate || new Date();

      // Query audit logs
      const logs = await this.auditService.queryLogs({
        tenantId,
        ...(filter?.userId ? { userId: filter.userId } : {}),
        ...(filter?.action ? { action: filter.action } : {}),
        ...(filter?.resource ? { resource: filter.resource } : {}),
        startDate,
        endDate,
        ...(filter?.severity ? { severity: filter.severity } : {}),
        ...(filter?.category ? { category: filter.category } : {}),
        limit: filter?.limit || 100,
        offset: filter?.offset || 0,
        orderBy: (filter?.orderBy as 'asc' | 'desc') || 'desc',
      });

      return logs.map(log => ({
        id: log.id,
        tenantId: log.tenantId || undefined,
        userId: log.userId || undefined,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId || undefined,
        oldValues: log.oldValues || undefined,
        newValues: log.newValues || undefined,
        metadata: log.metadata || undefined,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        timestamp: log.timestamp,
        severity: log.severity || undefined,
        category: log.category || undefined,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to fetch audit logs');
      throw error;
    }
  }

  /**
   * Get a specific audit log by ID
   * Read-only operation with strict permission controls
   */
  @Query(() => AuditLog, { name: 'auditLog', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('audit:read')
  async getAuditLog(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<AuditLog | null> {
    try {
      const log = await this.auditService.getLogById(tenantId, id);
      
      if (!log) {
        return null;
      }

      return {
        id: log.id,
        tenantId: log.tenantId || undefined,
        userId: log.userId || undefined,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId || undefined,
        oldValues: log.oldValues || undefined,
        newValues: log.newValues || undefined,
        metadata: log.metadata || undefined,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        timestamp: log.timestamp,
        severity: log.severity || undefined,
        category: log.category || undefined,
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch audit log');
      throw error;
    }
  }

  /**
   * Export audit logs to a file
   * Requires elevated permissions
   * Returns a job ID for tracking the export process
   */
  @Mutation(() => String, { name: 'exportAuditLogs' })
  @UseGuards(PermissionsGuard)
  @Permissions('audit:export')
  async exportAuditLogs(
    @Args('input') input: ExportAuditLogsInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      // Build filter
      const filter = input.filter || {};
      const startDate = filter.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = filter.endDate || new Date();

      // Export audit logs (this would typically enqueue a background job)
      const exportData = await this.auditService.exportLogs(
        tenantId,
        startDate,
        endDate,
        (input.format as 'json' | 'csv') || 'csv'
      );
      
      // Generate export ID for tracking
      const exportId = await this.auditService.initiateExport({
        tenantId,
        startDate,
        endDate,
        format: input.format || 'csv',
        requestedBy: user.id,
      });

      // Log the export request
      await this.auditService.logEvent({
        tenantId,
        userId: user.id,
        action: 'export',
        resource: 'audit_logs',
        metadata: {
          exportId,
          filter: input.filter,
          format: input.format,
        },
        severity: 'high',
        category: 'security',
      });

      return exportId;
    } catch (error) {
      this.handleError(error, 'Failed to export audit logs');
      throw error;
    }
  }

  /**
   * Get audit log statistics
   * Provides summary metrics for audit logs
   */
  @Query(() => Object, { name: 'auditLogStatistics' })
  @UseGuards(PermissionsGuard)
  @Permissions('audit:read')
  async getAuditLogStatistics(
    @Args('startDate', { type: () => Date, nullable: true }) startDate: Date,
    @Args('endDate', { type: () => Date, nullable: true }) endDate: Date,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const stats = await this.auditService.getStatistics(tenantId, start, end);

      return {
        tenantId,
        startDate: start,
        endDate: end,
        totalLogs: stats.totalLogs || 0,
        byAction: stats.byAction || {},
        byResource: stats.byResource || {},
        bySeverity: stats.bySeverity || {},
        byCategory: stats.byCategory || {},
        topUsers: stats.topUsers || [],
        topResources: stats.topResources || [],
      };
    } catch (error) {
      this.handleError(error, 'Failed to fetch audit log statistics');
      throw error;
    }
  }
}
