import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { SupplierService } from '../services/supplier.service';
import { SupplierEvaluation } from '../entities/supplier.entity';
import { Supplier } from '../entities/supplier.entity';
import { 
  CreateSupplierEvaluationInput, 
  UpdateSupplierEvaluationInput,
  DateRangeInput,
} from '../inputs/supplier.input';
import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
class EvaluationStats {
  @Field(() => Int)
  totalEvaluations!: number;

  @Field(() => Float)
  averageOverallScore!: number;

  @Field(() => Float)
  averageQualityScore!: number;

  @Field(() => Float)
  averageDeliveryScore!: number;

  @Field(() => Float)
  averageServiceScore!: number;

  @Field(() => Int)
  pendingApproval!: number;
}

@ObjectType()
class EvaluationListResponse {
  @Field(() => [SupplierEvaluation])
  evaluations!: SupplierEvaluation[];

  @Field(() => Int)
  total!: number;
}

@ObjectType()
class SupplierTrend {
  @Field()
  period!: string;

  @Field(() => Float)
  overallScore!: number;

  @Field(() => Float)
  qualityScore!: number;

  @Field(() => Float)
  deliveryScore!: number;

  @Field(() => Float)
  serviceScore!: number;
}

@Resolver(() => SupplierEvaluation)
@UseGuards(GraphQLJwtAuthGuard)
export class SupplierEvaluationResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly supplierService: SupplierService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => SupplierEvaluation, { name: 'supplierEvaluation' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getEvaluation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.getEvaluation(tenantId, id);
  }

  @Query(() => EvaluationListResponse, { name: 'supplierEvaluations' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplierEvaluations(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
    @CurrentTenant() tenantId: string,
  ): Promise<EvaluationListResponse> {
    const result = await this.supplierService.getSupplierEvaluations(tenantId, supplierId, limit, offset);
    return {
      evaluations: result.evaluations as any,
      total: result.total,
    };
  }

  @Query(() => SupplierEvaluation, { name: 'latestSupplierEvaluation', nullable: true })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getLatestEvaluation(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.getLatestEvaluation(tenantId, supplierId);
  }

  @Query(() => [SupplierEvaluation], { name: 'pendingEvaluations' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getPendingEvaluations(
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.supplierService.getPendingEvaluations(tenantId);
  }

  @Query(() => EvaluationStats, { name: 'evaluationStats' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getEvaluationStats(
    @Args('supplierId', { type: () => ID, nullable: true }) supplierId: string,
    @Args('dateRange', { type: () => DateRangeInput, nullable: true }) dateRange: DateRangeInput,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const startDate = dateRange ? new Date(dateRange.startDate) : undefined;
    const endDate = dateRange ? new Date(dateRange.endDate) : undefined;
    return this.supplierService.getEvaluationStats(tenantId, supplierId, startDate, endDate);
  }

  @Query(() => [SupplierTrend], { name: 'supplierTrends' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplierTrends(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @Args('months', { type: () => Int, nullable: true, defaultValue: 12 }) months: number,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.supplierService.getSupplierTrends(tenantId, supplierId, months);
  }

  @Mutation(() => SupplierEvaluation, { name: 'createSupplierEvaluation' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:evaluate')
  async createEvaluation(
    @Args('input') input: CreateSupplierEvaluationInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.createEvaluation(tenantId, input, user.id);
  }

  @Mutation(() => SupplierEvaluation, { name: 'updateSupplierEvaluation' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:evaluate')
  async updateEvaluation(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSupplierEvaluationInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.updateEvaluation(tenantId, id, input, user.id);
  }

  @Mutation(() => Boolean, { name: 'deleteSupplierEvaluation' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:delete')
  async deleteEvaluation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.supplierService.deleteEvaluation(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => SupplierEvaluation, { name: 'approveSupplierEvaluation' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:approve-evaluation')
  async approveEvaluation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.approveEvaluation(tenantId, id, user.id);
  }

  @Mutation(() => SupplierEvaluation, { name: 'rejectSupplierEvaluation' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:approve-evaluation')
  async rejectEvaluation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.rejectEvaluation(tenantId, id, user.id);
  }

  @ResolveField(() => Supplier, { name: 'supplier' })
  async supplier(
    @Parent() evaluation: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const loader = this.getDataLoader(
      'supplier_by_id',
      async (supplierIds: readonly string[]) => {
        const suppliers = await Promise.all(
          supplierIds.map(id => 
            this.supplierService.getSupplier(tenantId, id).catch(() => null)
          )
        );
        return suppliers.map(s => s || new Error('Supplier not found'));
      },
    );
    return loader.load(evaluation.supplierId);
  }
}
