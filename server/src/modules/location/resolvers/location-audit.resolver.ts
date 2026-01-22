import { Resolver, Query, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { LocationAuditService, AuditQuery, AuditSummary } from '../services/location-audit.service';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationAuditResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly auditService: LocationAuditService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => GraphQLJSONObject, { name: 'getLocationAuditHistory' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:audit')
  async getLocationAuditHistory(
    @CurrentTenant() tenantId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('userId', { type: () => ID, nullable: true }) userId?: string,
    @Args('actions', { type: () => [String], nullable: true }) actions?: string[],
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit: number = 50,
  ): Promise<{
    entries: any[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const query: AuditQuery & { locationId: string } = {
      locationId,
      userId: userId || '',
      actions: actions || [],
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: endDate || new Date(),
      page,
      limit,
    };

    return this.auditService.getLocationAuditHistory(tenantId, locationId, query);
  }

  @Query(() => GraphQLJSONObject, { name: 'getLocationAuditSummary' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:audit')
  async getLocationAuditSummary(
    @CurrentTenant() tenantId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('days', { type: () => Int, defaultValue: 30 }) days: number = 30,
  ): Promise<AuditSummary> {
    return this.auditService.getLocationAuditSummary(tenantId, locationId, days);
  }

  @Query(() => GraphQLJSONObject, { name: 'getTenantAuditHistory' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:audit')
  async getTenantAuditHistory(
    @CurrentTenant() tenantId: string,
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @Args('userId', { type: () => ID, nullable: true }) userId?: string,
    @Args('actions', { type: () => [String], nullable: true }) actions?: string[],
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit: number = 50,
  ): Promise<{
    entries: any[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const query: AuditQuery = {
      locationId: locationId || '',
      userId: userId || '',
      actions: actions || [],
      startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: endDate || new Date(),
      page,
      limit,
    };

    return this.auditService.getTenantAuditHistory(tenantId, query);
  }

  @Query(() => GraphQLJSONObject, { name: 'getComplianceReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:audit')
  async getComplianceReport(
    @CurrentTenant() tenantId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
  ): Promise<{
    period: { startDate: Date; endDate: Date };
    totalChanges: number;
    changesByAction: Record<string, number>;
    changesByUser: Array<{ userId: string; userName?: string; count: number }>;
    changesByLocation: Array<{ locationId: string; locationName?: string; count: number }>;
    criticalChanges: any[];
    complianceScore: number;
    recommendations: string[];
  }> {
    return this.auditService.getComplianceReport(tenantId, startDate, endDate);
  }
}