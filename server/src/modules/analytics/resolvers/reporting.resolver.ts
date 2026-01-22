import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { AnalyticsAPIService } from '../services/analytics-api.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class ReportingResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly analyticsAPIService: AnalyticsAPIService,
    private readonly cacheService: IntelligentCacheService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => String, { name: 'getReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getReport(
    @Args('reportId', { type: () => ID }) reportId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const cacheKey = `report:${tenantId}:${reportId}`;
      let report = await this.cacheService.get(cacheKey);

      if (!report) {
        report = { id: reportId, data: [] };
        await this.cacheService.set(cacheKey, report, { ttl: 3600 }); // 1-hour TTL
      }

      return JSON.stringify(report);
    } catch (error) {
      this.handleError(error, 'Failed to get report');
      throw error;
    }
  }

  @Mutation(() => String, { name: 'exportReport' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async exportReport(
    @Args('reportId', { type: () => ID }) reportId: string,
    @Args('format') format: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const result = await this.analyticsAPIService.exportData(
        tenantId,
        { format: format as any, query: reportId },
        user.id
      );
      return result.exportId;
    } catch (error) {
      this.handleError(error, 'Failed to export report');
      throw error;
    }
  }

  @Query(() => String, { name: 'getReportHistory' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async getReportHistory(
    @Args('reportId', { type: () => ID }) reportId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<string> {
    try {
      const history: any[] = [];
      return JSON.stringify(history);
    } catch (error) {
      this.handleError(error, 'Failed to get report history');
      throw error;
    }
  }
}
