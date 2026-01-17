import { Resolver, Query, Args, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { ComparativeAnalysisService } from '../services/comparative-analysis.service';
import { 
  ComparisonResult, 
  LocationComparison, 
  SegmentComparison 
} from '../types/analytics.types';
import { 
  TimePeriodComparisonInput, 
  LocationComparisonInput, 
  SegmentComparisonInput 
} from '../inputs/analytics.input';

interface ComparisonData {
  metricName: string;
  currentValue: number;
  comparisonValue: number;
  currentLabel?: string;
  comparisonLabel?: string;
  context?: string;
}

interface LocationData {
  locationId: string;
  locationName: string;
  metrics: Array<{ name: string; value: number; unit?: string }>;
  rank?: number;
}

interface SegmentData {
  segmentId: string;
  segmentName: string;
  metrics: Array<{ name: string; value: number; unit?: string }>;
  size?: number;
}

/**
 * GraphQL resolver for comparative analysis operations
 * Provides queries for comparing time periods, locations, and segments
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class ComparativeAnalysisResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly comparativeAnalysisService: ComparativeAnalysisService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Compare metrics between two time periods
   */
  @Query(() => [ComparisonResult], { name: 'compareTimePeriods' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read')
  async compareTimePeriods(
    @Args('input', { type: () => TimePeriodComparisonInput }) input: TimePeriodComparisonInput,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<ComparisonResult[]> {
    try {
      // Call actual service method
      const comparisons = await this.comparativeAnalysisService.compareTimePeriods?.(
        tenantId,
        {
          currentPeriod: {
            startDate: input.currentStartDate,
            endDate: input.currentEndDate,
          },
          comparisonPeriod: {
            startDate: input.comparisonStartDate,
            endDate: input.comparisonEndDate,
          },
          metricNames: input.metricNames || ['revenue', 'transactions', 'customers'],
        }
      ) || [];

      return comparisons.map((comparison: any) => ({
        id: comparison.id || `comparison_${comparison.metricName}_${Date.now()}`,
        comparisonType: 'TIME_PERIOD',
        metricName: comparison.metricName,
        currentValue: comparison.currentValue,
        comparisonValue: comparison.comparisonValue,
        variance: comparison.currentValue - comparison.comparisonValue,
        percentageChange: comparison.comparisonValue !== 0
          ? ((comparison.currentValue - comparison.comparisonValue) / comparison.comparisonValue) * 100
          : 0,
        currentLabel: comparison.currentLabel || 'Current Period',
        comparisonLabel: comparison.comparisonLabel || 'Comparison Period',
        context: comparison.context || undefined,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to compare time periods');
      throw error;
    }
  }

  /**
   * Compare metrics across multiple locations
   */
  @Query(() => [LocationComparison], { name: 'compareLocations' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read', 'location:read')
  async compareLocations(
    @Args('input', { type: () => LocationComparisonInput }) input: LocationComparisonInput,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationComparison[]> {
    try {
      // Call actual service method
      const comparisons = await this.comparativeAnalysisService.compareLocations?.(
        tenantId,
        {
          locationIds: input.locationIds,
          metricNames: input.metricNames,
          startDate: input.startDate,
          endDate: input.endDate,
        }
      ) || [];

      return comparisons.map((comparison: any, index: number) => ({
        locationId: comparison.locationId,
        locationName: comparison.locationName || `Location ${index + 1}`,
        metrics: comparison.metrics?.map((metric: any) => ({
          name: metric.name,
          value: metric.value,
          unit: metric.unit || undefined,
        })) || [],
        rank: comparison.rank || index + 1,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to compare locations');
      throw error;
    }
  }

  /**
   * Compare metrics across customer segments
   */
  @Query(() => [SegmentComparison], { name: 'compareSegments' })
  @UseGuards(PermissionsGuard)
  @Permissions('analytics:read', 'customer:read')
  async compareSegments(
    @Args('input', { type: () => SegmentComparisonInput }) input: SegmentComparisonInput,
    @CurrentUser() _user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<SegmentComparison[]> {
    try {
      // Call actual service method
      const comparisons = await this.comparativeAnalysisService.compareSegments?.(
        tenantId,
        {
          segmentIds: input.segmentIds,
          metricNames: input.metricNames,
          startDate: input.startDate,
          endDate: input.endDate,
        }
      ) || [];

      return comparisons.map((comparison: any) => ({
        segmentId: comparison.segmentId,
        segmentName: comparison.segmentName || `Segment ${comparison.segmentId}`,
        metrics: comparison.metrics?.map((metric: any) => ({
          name: metric.name,
          value: metric.value,
          unit: metric.unit || undefined,
        })) || [],
        size: comparison.size || 0,
      }));
    } catch (error) {
      this.handleError(error, 'Failed to compare segments');
      throw error;
    }
  }

  /**
   * Field resolver for variance calculation
   */
  @ResolveField(() => Number, { name: 'variance' })
  async variance(@Parent() comparison: ComparisonResult): Promise<number> {
    return comparison.currentValue - comparison.comparisonValue;
  }

  /**
   * Field resolver for percentage change calculation
   */
  @ResolveField(() => Number, { name: 'percentageChange' })
  async percentageChange(@Parent() comparison: ComparisonResult): Promise<number> {
    if (comparison.comparisonValue === 0) {
      return 0;
    }
    return ((comparison.currentValue - comparison.comparisonValue) / comparison.comparisonValue) * 100;
  }
}
