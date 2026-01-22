import { Resolver, Query, Mutation, Args, ResolveField, Parent, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { FranchiseService } from '../services/franchise.service';
import { GraphQLJSONObject } from 'graphql-type-json';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
class FranchiseType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => GraphQLJSONObject)
  performance?: any;
}

@Resolver(() => FranchiseType)
@UseGuards(JwtAuthGuard)
export class FranchiseResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly franchiseService: FranchiseService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => FranchiseType, { name: 'franchise' })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:read')
  async getFranchise(
    @Args('id', { type: () => ID }) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.franchiseService.getFranchiseById(tenantId, id);
  }

  @Query(() => [FranchiseType], { name: 'franchises' })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:read')
  async getFranchises(
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const { franchises } = await this.franchiseService.getFranchises(tenantId, {});
    return franchises;
  }

  @Query(() => GraphQLJSONObject, { name: 'getFranchisePerformance' })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:read')
  async getFranchisePerformance(
    @Args('id', { type: () => ID }) id: string,
    @Args('period', { nullable: true }) period: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.franchiseService.getFranchisePerformance(tenantId, id, period || 'monthly');
  }

  @Mutation(() => FranchiseType, { name: 'createFranchise' })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:create')
  async createFranchise(
    @Args('input', { type: () => GraphQLJSONObject }) input: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.franchiseService.createFranchise(tenantId, input, user.id);
  }

  @Mutation(() => FranchiseType, { name: 'updateFranchise' })
  @UseGuards(PermissionsGuard)
  @Permissions('franchise:update')
  async updateFranchise(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => GraphQLJSONObject }) input: any,
    @CurrentUser() user: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.franchiseService.updateFranchise(tenantId, id, input, user.id);
  }

  @ResolveField(() => GraphQLJSONObject)
  async performance(@Parent() franchise: any, @CurrentTenant() tenantId: string): Promise<any> {
    return this.franchiseService.getFranchisePerformance(tenantId, franchise.id, 'monthly');
  }
}
