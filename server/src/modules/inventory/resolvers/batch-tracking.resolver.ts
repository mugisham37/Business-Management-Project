import { Resolver, Query, Mutation, Args, ResolveField, Parent, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/require-permission.decorator';
import { BatchTrackingService } from '../services/batch-tracking.service';
import { ProductService } from '../services/product.service';
import { BatchTrackingResult } from '../types/batch.types';
import { CreateBatchInput, UpdateBatchInput, BatchFilterInput } from '../inputs/batch.input';
import { OffsetPaginationArgs } from '../../../common/graphql/pagination.args';

@Resolver(() => BatchTrackingResult)
@UseGuards(JwtAuthGuard)
export class BatchTrackingResolver extends BaseResolver {
  constructor(
    override readonly dataLoaderService: DataLoaderService,
    private readonly batchTrackingService: BatchTrackingService,
    private readonly productService: ProductService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => BatchTrackingResult, { description: 'Get batch tracking result by ID' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async batchTracking(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<BatchTrackingResult> {
    return this.batchTrackingService.getTracking(tenantId, productId, locationId);
  }

  @Query(() => [BatchTrackingResult], { description: 'Get batches with optional filtering' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async batchTrackings(
    @Args('filter', { type: () => BatchFilterInput, nullable: true }) filter: BatchFilterInput | null,
    @Args('pagination', { type: () => OffsetPaginationArgs, nullable: true }) pagination: OffsetPaginationArgs | null,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<BatchTrackingResult[]> {
    // Build query object with only defined properties to satisfy exactOptionalPropertyTypes
    const query: {
      productId?: string;
      locationId?: string;
      status?: 'active' | 'consumed' | 'expired' | 'recalled';
      expiryDateFrom?: Date;
      expiryDateTo?: Date;
      offset: number;
      limit: number;
    } = {
      offset: pagination?.offset || 0,
      limit: pagination?.limit || 20,
    };

    if (filter?.productId) query.productId = filter.productId;
    if (filter?.locationId) query.locationId = filter.locationId;
    if (filter?.status) query.status = filter.status as 'active' | 'consumed' | 'expired' | 'recalled';
    if (filter?.expiryDateFrom) query.expiryDateFrom = new Date(filter.expiryDateFrom);
    if (filter?.expiryDateTo) query.expiryDateTo = new Date(filter.expiryDateTo);

    const result = await this.batchTrackingService.findBatches(tenantId, query);
    return result.batches || [];
  }

  @Query(() => [BatchTrackingResult], { description: 'Get batches expiring within specified days' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async expiringBatches(
    @Args('daysAhead', { type: () => Int, defaultValue: 30 }) daysAhead: number,
    @Args('locationId', { type: () => ID, nullable: true }) locationId?: string | null,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<BatchTrackingResult[]> {
    // getExpiringBatches expects locationId?: string, so convert null to undefined
    return this.batchTrackingService.getExpiringBatches(tenantId || '', daysAhead, locationId ?? undefined);
  }

  @Query(() => [BatchTrackingResult], { description: 'Get FIFO batches for product at location' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async fifoBatches(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('variantId', { type: () => ID, nullable: true }) variantId?: string,
    @Args('locationId', { type: () => ID }) locationId?: string,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<BatchTrackingResult[]> {
    // getFIFOBatches expects variantId: string | null, so convert undefined to null
    return this.batchTrackingService.getFIFOBatches(tenantId || '', productId, variantId ?? null, locationId || '');
  }

  @Mutation(() => BatchTrackingResult, { description: 'Create new batch tracking' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:create')
  async createBatchTracking(
    @Args('input') input: CreateBatchInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<BatchTrackingResult> {
    // Convert string dates from GraphQL input to Date objects for the service
    const batchData = {
      productId: input.productId,
      locationId: input.locationId,
      batchNumber: input.batchNumber,
      originalQuantity: input.originalQuantity,
      unitCost: input.unitCost,
      receivedDate: new Date(input.receivedDate),
      ...(input.expiryDate && { expiryDate: new Date(input.expiryDate) }),
    };
    return this.batchTrackingService.createBatch(tenantId || '', batchData, user?.id);
  }
}
