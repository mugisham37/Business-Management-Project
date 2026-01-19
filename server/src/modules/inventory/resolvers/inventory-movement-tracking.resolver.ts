import { Resolver, Query, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { InventoryMovementTrackingService } from '../services/inventory-movement-tracking.service';
import { 
  MovementHistoryResult,
  MovementVelocityAnalysisResult,
  MovementPatternAnalysisResult,
  InventoryAccuracyMetricsResult,
  MovementAuditTrailResult,
  AnomalousMovementResult 
} from '../types/movement-tracking.types';

@Resolver(() => MovementHistoryResult)
@UseGuards(JwtAuthGuard)
export class InventoryMovementTrackingResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly movementTrackingService: InventoryMovementTrackingService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => MovementHistoryResult, { description: 'Get detailed movement history' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:read')
  async detailedMovementHistory(
    @Args('productId', { type: () => ID, nullable: true }) productId?: string,
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @Args('movementType', { nullable: true }) movementType?: string,
    @Args('dateFrom', { nullable: true }) dateFrom?: Date,
    @Args('dateTo', { nullable: true }) dateTo?: Date,
    @Args('page', { type: () => Int, defaultValue: 1 }) page?: number,
    @Args('limit', { type: () => Int, defaultValue: 100 }) limit?: number,
    @CurrentTenant() tenantId?: string,
  ): Promise<MovementHistoryResult> {
    // Build query object with only defined properties to satisfy exactOptionalPropertyTypes
    const query: {
      productId?: string;
      locationId?: string;
      movementType?: string;
      dateFrom?: Date;
      dateTo?: Date;
      page?: number;
      limit?: number;
    } = {};

    if (productId) query.productId = productId;
    if (locationId) query.locationId = locationId;
    if (movementType) query.movementType = movementType;
    if (dateFrom) query.dateFrom = dateFrom;
    if (dateTo) query.dateTo = dateTo;
    if (page !== undefined) query.page = page;
    if (limit !== undefined) query.limit = limit;

    const result = await this.movementTrackingService.getDetailedMovementHistory(tenantId || '', query);
    
    return {
      movements: result.movements,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      summary: result.summary,
    };
  }

  @Query(() => MovementVelocityAnalysisResult, { description: 'Analyze movement velocity' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:read')
  async movementVelocityAnalysis(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('periodDays', { type: () => Int, defaultValue: 30 }) periodDays?: number,
    @CurrentTenant() tenantId?: string,
  ): Promise<MovementVelocityAnalysisResult> {
    return this.movementTrackingService.analyzeMovementVelocity(
      tenantId || '',
      productId,
      locationId,
      periodDays || 30,
    );
  }

  @Query(() => MovementPatternAnalysisResult, { description: 'Analyze movement patterns' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:read')
  async movementPatternAnalysis(
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @Args('periodDays', { type: () => Int, defaultValue: 90 }) periodDays?: number,
    @CurrentTenant() tenantId?: string,
  ): Promise<MovementPatternAnalysisResult> {
    return this.movementTrackingService.analyzeMovementPatterns(
      tenantId || '',
      locationId,
      periodDays || 90,
    );
  }

  @Query(() => InventoryAccuracyMetricsResult, { description: 'Calculate inventory accuracy' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:read')
  async inventoryAccuracyMetrics(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('periodDays', { type: () => Int, defaultValue: 30 }) periodDays?: number,
    @CurrentTenant() tenantId?: string,
  ): Promise<InventoryAccuracyMetricsResult> {
    return this.movementTrackingService.calculateInventoryAccuracy(
      tenantId || '',
      locationId,
      periodDays || 30,
    );
  }

  @Query(() => AnomalousMovementResult, { description: 'Detect anomalous movements' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:read')
  async detectAnomalousMovements(
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @Args('lookbackDays', { type: () => Int, defaultValue: 30 }) lookbackDays?: number,
    @CurrentTenant() tenantId?: string,
  ): Promise<AnomalousMovementResult> {
    return this.movementTrackingService.detectAnomalousMovements(
      tenantId || '',
      locationId,
      lookbackDays || 30,
    );
  }

  @Query(() => MovementAuditTrailResult, { description: 'Get movement audit trail' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('inventory:read')
  async movementAuditTrail(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string,
    @Args('dateFrom', { nullable: true }) dateFrom?: Date,
    @Args('dateTo', { nullable: true }) dateTo?: Date,
    @CurrentTenant() tenantId?: string,
  ): Promise<MovementAuditTrailResult> {
    return this.movementTrackingService.getMovementAuditTrail(
      tenantId || '',
      productId,
      locationId,
      dateFrom,
      dateTo,
    );
  }
}
