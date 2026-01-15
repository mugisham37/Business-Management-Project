import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { CacheInterceptor } from '../../../common/interceptors/cache.interceptor';
import { ProcurementAnalyticsService } from '../services/procurement-analytics.service';
import { 
  SupplierPerformanceMetricsType,
  SpendAnalysisType,
  CostTrendType,
  LeadTimeAnalysisType,
  AnalyticsDateRangeInput,
} from '../types/procurement-analytics.types';

@Resolver()
@UseGuards(JwtAuthGuard)
@UseInterceptors(CacheInterceptor)
export class ProcurementAnalyticsResolver extends BaseResolver {
  constructor(
    protected readonly dataLoaderService: DataLoaderService,
    private readonly procurementAnalyticsService: ProcurementAnalyticsService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => SupplierPerformanceMetricsType, { name: 'getSupplierPerformance' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:analytics:read')
  async getSupplierPerformance(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @Args('input') input: AnalyticsDateRangeInput,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const metrics = await this.procurementAnalyticsService.calculateSupplierPerformanceMetrics(
      tenantId,
      input.startDate,
      input.endDate,
      supplierId,
    );
    return metrics[0] || null;
  }

  @Query(() => [SupplierPerformanceMetricsType], { name: 'getAllSupplierPerformance' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:analytics:read')
  async getAllSupplierPerformance(
    @Args('input') input: AnalyticsDateRangeInput,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.procurementAnalyticsService.calculateSupplierPerformanceMetrics(
      tenantId,
      input.startDate,
      input.endDate,
    );
  }

  @Query(() => SpendAnalysisType, { name: 'getSpendAnalysis' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:analytics:read')
  async getSpendAnalysis(
    @Args('input') input: AnalyticsDateRangeInput,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.procurementAnalyticsService.generateSpendAnalysis(
      tenantId,
      input.startDate,
      input.endDate,
    );
  }

  @Query(() => [CostTrendType], { name: 'getCostTrends' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:analytics:read')
  async getCostTrends(
    @Args('input') input: AnalyticsDateRangeInput,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const spendAnalysis = await this.procurementAnalyticsService.generateSpendAnalysis(
      tenantId,
      input.startDate,
      input.endDate,
    );
    return spendAnalysis.spendByMonth || [];
  }

  @Query(() => [LeadTimeAnalysisType], { name: 'getLeadTimeAnalysis' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:analytics:read')
  async getLeadTimeAnalysis(
    @Args('input') input: AnalyticsDateRangeInput,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    // Get supplier performance metrics which include lead time data
    const metrics = await this.procurementAnalyticsService.calculateSupplierPerformanceMetrics(
      tenantId,
      input.startDate,
      input.endDate,
    );

    // Transform to lead time analysis format
    return metrics.map(metric => ({
      supplierId: metric.supplierId,
      supplierName: metric.supplierName,
      averageLeadTime: metric.averageResponseTime,
      minLeadTime: metric.averageResponseTime * 0.7, // Mock calculation
      maxLeadTime: metric.averageResponseTime * 1.5, // Mock calculation
      onTimeDeliveryPercentage: metric.onTimeDeliveryRate,
    }));
  }
}
