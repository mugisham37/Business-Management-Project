import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent, Int, Float, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { PubSubService } from '../../../common/graphql/pubsub.service';
import { SupplierService } from '../services/supplier.service';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { Supplier, SupplierContact, SupplierCommunication, SupplierEvaluation, SupplierPerformanceMetrics } from '../entities/supplier.entity';
import { 
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierFilterInput,
  DateRangeInput,
} from '../inputs/supplier.input';
import { PurchaseOrderType } from '../types/purchase-order.types';
import { ObjectType, Field } from '@nestjs/graphql';
import { Connection, Edge } from '../../../common/graphql/base.types';

@ObjectType()
class SupplierEdge extends Edge<Supplier> {
  @Field(() => Supplier)
  node!: Supplier;
}

@ObjectType()
class SupplierConnection extends Connection<Supplier> {
  @Field(() => [SupplierEdge])
  edges!: SupplierEdge[];
}

@ObjectType()
class CommunicationListResponse {
  @Field(() => [SupplierCommunication])
  communications!: SupplierCommunication[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Boolean)
  hasNextPage!: boolean;
}

@ObjectType()
class EvaluationListResponse {
  @Field(() => [SupplierEvaluation])
  evaluations!: SupplierEvaluation[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Boolean)
  hasNextPage!: boolean;
}

@ObjectType()
class SupplierStats {
  @Field(() => Int)
  totalSuppliers!: number;

  @Field(() => Int)
  activeSuppliers!: number;

  @Field(() => Int)
  inactiveSuppliers!: number;

  @Field(() => Int)
  preferredSuppliers!: number;

  @Field(() => Float)
  averageRating!: number;
}

@ObjectType()
class SupplierPerformanceScore {
  @Field(() => Float)
  overallScore!: number;

  @Field(() => Float)
  qualityScore!: number;

  @Field(() => Float)
  deliveryScore!: number;

  @Field(() => Float)
  serviceScore!: number;

  @Field(() => Float)
  communicationScore!: number;
}

@Resolver(() => Supplier)
@UseGuards(GraphQLJwtAuthGuard)
export class SupplierResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly supplierService: SupplierService,
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly pubSubService: PubSubService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => Supplier, { name: 'supplier' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplier(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.getSupplier(tenantId, id);
  }

  @Query(() => Supplier, { name: 'supplierByCode' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplierByCode(
    @Args('supplierCode') supplierCode: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.getSupplierByCode(tenantId, supplierCode);
  }

  @Query(() => SupplierConnection, { name: 'suppliers' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSuppliers(
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first: number,
    @Args('after', { type: () => String, nullable: true }) after: string,
    @Args('filter', { type: () => SupplierFilterInput, nullable: true }) filter: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const { limit } = this.parsePaginationArgs({ first, after });
    
    const query = {
      page: 1,
      limit,
      ...filter,
    };

    const result = await this.supplierService.getSuppliers(tenantId, query);
    
    return {
      edges: this.createEdges(result.suppliers, supplier => supplier.id),
      pageInfo: this.createPageInfo(
        result.page < result.totalPages,
        result.page > 1,
        result.suppliers[0]?.id,
        result.suppliers[result.suppliers.length - 1]?.id,
      ),
      totalCount: result.total,
    };
  }

  @Query(() => [Supplier], { name: 'preferredSuppliers' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getPreferredSuppliers(
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.supplierService.getPreferredSuppliers(tenantId);
  }

  @Query(() => [Supplier], { name: 'suppliersByStatus' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSuppliersByStatus(
    @Args('status') status: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.supplierService.getSuppliersByStatus(tenantId, status);
  }

  @Query(() => [Supplier], { name: 'searchSuppliers' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async searchSuppliers(
    @Args('searchTerm') searchTerm: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 }) limit: number,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.supplierService.searchSuppliers(tenantId, searchTerm, limit);
  }

  @Query(() => SupplierStats, { name: 'supplierStats' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplierStats(
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.getSupplierStats(tenantId);
  }

  @Query(() => SupplierPerformanceScore, { name: 'supplierPerformanceScore' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplierPerformanceScore(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @Args('dateRange') dateRange: DateRangeInput,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const periodStart = new Date(dateRange.startDate);
    const periodEnd = new Date(dateRange.endDate);
    return this.supplierService.calculateSupplierPerformanceScore(
      tenantId,
      supplierId,
      periodStart,
      periodEnd,
    );
  }

  @Query(() => CommunicationListResponse, { name: 'supplierCommunicationsList' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplierCommunicationsList(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
    @CurrentTenant() tenantId: string,
  ): Promise<CommunicationListResponse> {
    const result = await this.supplierService.getSupplierCommunications(tenantId, supplierId, limit, offset);
    return {
      communications: result.communications.map((comm: any) => ({
        ...comm,
        contactId: comm.contactId || '',
      })),
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
      hasNextPage: offset + limit < result.total,
    };
  }

  @Query(() => EvaluationListResponse, { name: 'supplierEvaluationsList' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplierEvaluationsList(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
    @CurrentTenant() tenantId: string,
  ): Promise<EvaluationListResponse> {
    const result = await this.supplierService.getSupplierEvaluations(tenantId, supplierId, limit, offset);
    return {
      evaluations: result.evaluations.map((evaluation: any) => ({
        ...evaluation,
        overallScore: parseFloat(evaluation.overallScore) || 0,
      })),
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
      hasNextPage: offset + limit < result.total,
    };
  }

  @Mutation(() => Supplier, { name: 'createSupplier' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:create')
  async createSupplier(
    @Args('input') input: CreateSupplierInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.createSupplier(tenantId, input, user.id);
  }

  @Mutation(() => Supplier, { name: 'updateSupplier' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:update')
  async updateSupplier(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSupplierInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.updateSupplier(tenantId, id, input, user.id);
  }

  @Mutation(() => Boolean, { name: 'deleteSupplier' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:delete')
  async deleteSupplier(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.supplierService.deleteSupplier(tenantId, id, user.id);
    return true;
  }

  // Field Resolvers
  @ResolveField(() => [PurchaseOrderType], { name: 'purchaseOrders', nullable: true })
  async purchaseOrders(
    @Parent() supplier: any,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 100 }) limit: number,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const result = await this.purchaseOrderService.getPurchaseOrders(tenantId, {
      supplierId: supplier.id,
    });
    return result.purchaseOrders.slice(0, limit) || [];
  }

  @ResolveField(() => [SupplierContact], { name: 'contacts', nullable: true })
  async contacts(
    @Parent() supplier: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.supplierService.getSupplierContacts(tenantId, supplier.id);
  }

  @ResolveField(() => [SupplierCommunication], { name: 'communications', nullable: true })
  async communications(
    @Parent() supplier: any,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const result = await this.supplierService.getSupplierCommunications(tenantId, supplier.id, limit, 0);
    return result.communications || [];
  }

  @ResolveField(() => [SupplierEvaluation], { name: 'evaluations', nullable: true })
  async evaluations(
    @Parent() supplier: any,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const result = await this.supplierService.getSupplierEvaluations(tenantId, supplier.id, limit, 0);
    return result.evaluations || [];
  }

  @ResolveField(() => SupplierEvaluation, { name: 'latestEvaluation', nullable: true })
  async latestEvaluation(
    @Parent() supplier: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.getLatestEvaluation(tenantId, supplier.id);
  }

  @ResolveField(() => [SupplierPerformanceMetrics], { name: 'performanceMetrics', nullable: true })
  async performanceMetrics(
    @Parent() supplier: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    return this.supplierService.getSupplierPerformanceMetrics(tenantId, supplier.id);
  }

  @ResolveField(() => SupplierPerformanceScore, { name: 'currentPerformanceScore', nullable: true })
  async currentPerformanceScore(
    @Parent() supplier: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12); // Last 12 months
    
    return this.supplierService.calculateSupplierPerformanceScore(
      tenantId,
      supplier.id,
      startDate,
      endDate,
    );
  }

  // Subscriptions for real-time updates
  @Subscription(() => Supplier, {
    name: 'supplierCreated',
    filter: (payload, variables, context) => {
      return payload.supplierCreated.tenantId === context.req.user.tenantId;
    },
  })
  supplierCreated(@CurrentTenant() tenantId: string) {
    return this.pubSubService.asyncIterator('SUPPLIER_CREATED', tenantId);
  }

  @Subscription(() => Supplier, {
    name: 'supplierUpdated',
    filter: (payload, variables, context) => {
      return payload.supplierUpdated.tenantId === context.req.user.tenantId;
    },
  })
  supplierUpdated(@CurrentTenant() tenantId: string) {
    return this.pubSubService.asyncIterator('SUPPLIER_UPDATED', tenantId);
  }

  @Subscription(() => SupplierEvaluation, {
    name: 'supplierEvaluated',
    filter: (payload, variables, context) => {
      return payload.supplierEvaluated.tenantId === context.req.user.tenantId;
    },
  })
  supplierEvaluated(@CurrentTenant() tenantId: string) {
    return this.pubSubService.asyncIterator('SUPPLIER_EVALUATED', tenantId);
  }
}
