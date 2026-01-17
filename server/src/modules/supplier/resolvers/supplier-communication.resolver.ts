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
import { SupplierCommunication } from '../entities/supplier.entity';
import { Supplier, SupplierContact } from '../entities/supplier.entity';
import { 
  CreateSupplierCommunicationInput, 
  UpdateSupplierCommunicationInput,
  DateRangeInput,
} from '../inputs/supplier.input';
import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
class CommunicationStats {
  @Field(() => Int)
  totalCommunications!: number;

  @Field(() => Int)
  pendingFollowUps!: number;

  @Field(() => Float)
  averageResponseTime!: number;
}

@ObjectType()
class CommunicationListResponse {
  @Field(() => [SupplierCommunication])
  communications!: SupplierCommunication[];

  @Field(() => Int)
  total!: number;
}

@ObjectType()
class CommunicationByTypeStats {
  @Field(() => Int)
  emailCount!: number;

  @Field(() => Int)
  phoneCount!: number;

  @Field(() => Int)
  meetingCount!: number;

  @Field(() => Int)
  inboundCount!: number;

  @Field(() => Int)
  outboundCount!: number;
}

@Resolver(() => SupplierCommunication)
@UseGuards(GraphQLJwtAuthGuard)
export class SupplierCommunicationResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly supplierService: SupplierService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => SupplierCommunication, { name: 'supplierCommunication' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getCommunication(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.getCommunication(tenantId, id);
  }

  @Query(() => CommunicationListResponse, { name: 'supplierCommunications' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getSupplierCommunications(
    @Args('supplierId', { type: () => ID }) supplierId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
    @CurrentTenant() tenantId: string,
  ): Promise<CommunicationListResponse> {
    const result = await this.supplierService.getSupplierCommunications(tenantId, supplierId, limit, offset);
    return {
      communications: result.communications as any,
      total: result.total,
    };
  }

  @Query(() => [SupplierCommunication], { name: 'pendingFollowUps' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getPendingFollowUps(
    @Args('beforeDate', { type: () => String, nullable: true }) beforeDate: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const date = beforeDate ? new Date(beforeDate) : undefined;
    return this.supplierService.getPendingFollowUps(tenantId, date);
  }

  @Query(() => CommunicationStats, { name: 'communicationStats' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getCommunicationStats(
    @Args('supplierId', { type: () => ID, nullable: true }) supplierId: string,
    @Args('dateRange', { type: () => DateRangeInput, nullable: true }) dateRange: DateRangeInput,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    const startDate = dateRange ? new Date(dateRange.startDate) : undefined;
    const endDate = dateRange ? new Date(dateRange.endDate) : undefined;
    return this.supplierService.getCommunicationStats(tenantId, supplierId, startDate, endDate);
  }

  @Query(() => CommunicationByTypeStats, { name: 'communicationByTypeStats' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:read')
  async getCommunicationByTypeStats(
    @Args('supplierId', { type: () => ID, nullable: true }) supplierId: string,
    @Args('dateRange', { type: () => DateRangeInput, nullable: true }) dateRange: DateRangeInput,
    @CurrentTenant() tenantId: string,
  ): Promise<CommunicationByTypeStats> {
    const startDate = dateRange ? new Date(dateRange.startDate) : undefined;
    const endDate = dateRange ? new Date(dateRange.endDate) : undefined;
    const stats = await this.supplierService.getCommunicationStats(tenantId, supplierId, startDate, endDate);
    
    return {
      emailCount: stats.byType?.email || 0,
      phoneCount: stats.byType?.phone || 0,
      meetingCount: stats.byType?.meeting || 0,
      inboundCount: stats.byDirection?.inbound || 0,
      outboundCount: stats.byDirection?.outbound || 0,
    };
  }

  @Mutation(() => SupplierCommunication, { name: 'createSupplierCommunication' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:create')
  async createCommunication(
    @Args('input') input: CreateSupplierCommunicationInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.createCommunication(tenantId, input, user.id);
  }

  @Mutation(() => SupplierCommunication, { name: 'updateSupplierCommunication' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:update')
  async updateCommunication(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSupplierCommunicationInput,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.updateCommunication(tenantId, id, input, user.id);
  }

  @Mutation(() => Boolean, { name: 'deleteSupplierCommunication' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:delete')
  async deleteCommunication(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    await this.supplierService.deleteCommunication(tenantId, id, user.id);
    return true;
  }

  @Mutation(() => SupplierCommunication, { name: 'markFollowUpComplete' })
  @UseGuards(PermissionsGuard)
  @Permissions('supplier:update')
  async markFollowUpComplete(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.supplierService.markFollowUpComplete(tenantId, id, user.id);
  }

  @ResolveField(() => Supplier, { name: 'supplier' })
  async supplier(
    @Parent() communication: any,
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
    return loader.load(communication.supplierId);
  }

  @ResolveField(() => SupplierContact, { name: 'contact', nullable: true })
  async contact(
    @Parent() communication: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    if (!communication.contactId) return null;
    
    const loader = this.getDataLoader(
      'supplier_contact_by_id',
      async (contactIds: readonly string[]) => {
        const contacts = await Promise.all(
          contactIds.map(id => 
            this.supplierService.getSupplierContact(tenantId, id).catch(() => null)
          )
        );
        return contacts.map(c => c || new Error('Contact not found'));
      },
    );
    return loader.load(communication.contactId);
  }
}
