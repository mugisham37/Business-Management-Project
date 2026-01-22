import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { LocationPermissionsService, LocationPermission, LocationAccessCheck } from '../services/location-permissions.service';
import { LocationPermissionDto } from '../dto/location.dto';
import { GraphQLJSONObject } from 'graphql-type-json';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LocationPermissionsResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly permissionsService: LocationPermissionsService,
  ) {
    super(dataLoaderService);
  }

  @Mutation(() => GraphQLJSONObject, { name: 'grantLocationAccess' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:manage_permissions')
  async grantLocationAccess(
    @Args('input') input: LocationPermissionDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: any,
  ): Promise<LocationPermission> {
    return this.permissionsService.grantLocationAccess(tenantId, input, currentUser.id);
  }

  @Mutation(() => Boolean, { name: 'revokeLocationAccess' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:manage_permissions')
  async revokeLocationAccess(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: any,
  ): Promise<boolean> {
    await this.permissionsService.revokeLocationAccess(tenantId, userId, locationId, currentUser.id);
    return true;
  }

  @Mutation(() => GraphQLJSONObject, { name: 'updateLocationPermissions' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:manage_permissions')
  async updateLocationPermissions(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: any,
    @Args('role', { nullable: true }) role?: string,
    @Args('permissions', { type: () => [String], nullable: true }) permissions?: string[],
  ): Promise<LocationPermission> {
    const updates: any = {};
    if (role) updates.role = role;
    if (permissions) updates.permissions = permissions;

    return this.permissionsService.updateLocationPermissions(
      tenantId,
      userId,
      locationId,
      updates,
      currentUser.id,
    );
  }

  @Query(() => GraphQLJSONObject, { name: 'checkLocationAccess' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async checkLocationAccess(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
    @Args('requiredPermission', { nullable: true }) requiredPermission?: string,
  ): Promise<LocationAccessCheck> {
    return this.permissionsService.checkLocationAccess(tenantId, userId, locationId, requiredPermission);
  }

  @Query(() => [GraphQLJSONObject], { name: 'getUserAccessibleLocations' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getUserAccessibleLocations(
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{
    locationId: string;
    locationName: string;
    role: string;
    permissions: string[];
  }>> {
    return this.permissionsService.getUserAccessibleLocations(tenantId, userId);
  }

  @Query(() => [GraphQLJSONObject], { name: 'getLocationUsers' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async getLocationUsers(
    @Args('locationId', { type: () => ID }) locationId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{
    userId: string;
    userName: string;
    role: string;
    permissions: string[];
    grantedAt: Date;
    grantedBy: string;
  }>> {
    return this.permissionsService.getLocationUsers(tenantId, locationId);
  }

  @Mutation(() => [GraphQLJSONObject], { name: 'bulkGrantPermissions' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:manage_permissions')
  async bulkGrantPermissions(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('userPermissions', { type: () => [GraphQLJSONObject] }) userPermissions: Array<{
      userId: string;
      role: string;
      permissions?: string[];
    }>,
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: any,
  ): Promise<LocationPermission[]> {
    return this.permissionsService.bulkGrantPermissions(
      tenantId,
      locationId,
      userPermissions,
      currentUser.id,
    );
  }

  @Query(() => Boolean, { name: 'validatePermissionHierarchy' })
  @UseGuards(PermissionsGuard)
  @Permissions('location:read')
  async validatePermissionHierarchy(
    @Args('granterId', { type: () => ID }) granterId: string,
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('targetRole') targetRole: string,
    @CurrentTenant() tenantId: string,
  ): Promise<boolean> {
    return this.permissionsService.validatePermissionHierarchy(tenantId, granterId, locationId, targetRole);
  }
}