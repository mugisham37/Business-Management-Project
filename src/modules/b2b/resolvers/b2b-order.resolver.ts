import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { B2BOrderService } from '../services/b2b-order.service';
import { CreateB2BOrderDto, UpdateB2BOrderDto, B2BOrderQueryDto } from '../dto/b2b-order.dto';

@Resolver('B2BOrder')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('b2b-operations')
export class B2BOrderResolver {
  private readonly logger = new Logger(B2BOrderResolver.name);

  constructor(
    private readonly b2bOrderService: B2BOrderService,
  ) {}

  @Query('b2bOrders')
  @RequirePermission('b2b_order:read')
  async getB2BOrders(
    @Args('query') query: B2BOrderQueryDto,
    @Context() context: any,
  ) {
    try {
      const tenantId = context.req.user.tenantId;
      const result = await this.b2bOrderService.findB2BOrders(tenantId, query);

      return {
        orders: result.orders,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Failed to get B2B orders:`, error);
      throw error;
    }
  }

  @Query('b2bOrder')
  @RequirePermission('b2b_order:read')
  async getB2BOrder(
    @Args('id') id: string,
    @Context() context: any,
  ) {
    try {
      const tenantId = context.req.user.tenantId;
      return await this.b2bOrderService.findB2BOrderById(tenantId, id);
    } catch (error) {
      this.logger.error(`Failed to get B2B order ${id}:`, error);
      throw error;
    }
  }

  @Mutation('createB2BOrder')
  @RequirePermission('b2b_order:create')
  async createB2BOrder(
    @Args('input') input: CreateB2BOrderDto,
    @Context() context: any,
  ) {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const order = await this.b2bOrderService.createB2BOrder(
        tenantId,
        input,
        userId,
      );

      this.logger.log(`Created B2B order ${order.orderNumber} via GraphQL`);
      return order;
    } catch (error) {
      this.logger.error(`Failed to create B2B order via GraphQL:`, error);
      throw error;
    }
  }

  @Mutation('updateB2BOrder')
  @RequirePermission('b2b_order:update')
  async updateB2BOrder(
    @Args('id') id: string,
    @Args('input') input: UpdateB2BOrderDto,
    @Context() context: any,
  ) {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const order = await this.b2bOrderService.updateB2BOrder(
        tenantId,
        id,
        input,
        userId,
      );

      this.logger.log(`Updated B2B order ${id} via GraphQL`);
      return order;
    } catch (error) {
      this.logger.error(`Failed to update B2B order ${id} via GraphQL:`, error);
      throw error;
    }
  }

  @Mutation('approveB2BOrder')
  @RequirePermission('b2b_order:approve')
  async approveB2BOrder(
    @Args('id') id: string,
    @Args('approvalNotes') approvalNotes: string,
    @Context() context: any,
  ) {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const order = await this.b2bOrderService.approveOrder(
        tenantId,
        id,
        approvalNotes,
        userId,
      );

      this.logger.log(`Approved B2B order ${id} via GraphQL`);
      return order;
    } catch (error) {
      this.logger.error(`Failed to approve B2B order ${id} via GraphQL:`, error);
      throw error;
    }
  }

  @Mutation('rejectB2BOrder')
  @RequirePermission('b2b_order:approve')
  async rejectB2BOrder(
    @Args('id') id: string,
    @Args('rejectionReason') rejectionReason: string,
    @Context() context: any,
  ) {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const order = await this.b2bOrderService.rejectOrder(
        tenantId,
        id,
        rejectionReason,
        userId,
      );

      this.logger.log(`Rejected B2B order ${id} via GraphQL`);
      return order;
    } catch (error) {
      this.logger.error(`Failed to reject B2B order ${id} via GraphQL:`, error);
      throw error;
    }
  }
}