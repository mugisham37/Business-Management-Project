import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PermissionsService } from '../services/permissions.service';
import { CacheService } from '../../cache/cache.service';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../decorators/permission.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthenticatedUser } from '../interfaces/auth.interface';
import { MutationResponse } from '../../../common/graphql/mutation-response.types';
import {
  GrantPermissionInput,
  RevokePermissionInput,
  AssignRoleInput,
  CreateRoleInput,
  UpdateRolePermissionsInput,
} from '../inputs/permissions.input';
import {
  Permission,
  Role,
  UserPermissionsResponse,
} from '../types/permissions.types';

/**
 * Permissions resolver for permission and role management
 * Handles permission queries, role assignment, and permission grants/revokes
 * Implements caching for user permissions with 15-minute TTL
 * All mutations require admin or tenant_admin role
 */
@Resolver()
@UseGuards(JwtAuthGuard)
export class PermissionsResolver extends BaseResolver {
  private readonly PERMISSIONS_CACHE_TTL = 15 * 60; // 15 minutes in seconds

  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly permissionsService: PermissionsService,
    private readonly cacheService: CacheService,
  ) {
    super(dataLoaderService);
  }

  /**
   * Get permissions for a user
   * Returns all permissions (role-based + custom)
   * Cached for 15 minutes
   */
  @Query(() => [String], {
    description: 'Get all permissions for a user',
  })
  @UseGuards(PermissionsGuard)
  @Permissions('permissions:read')
  async getPermissions(
    @Args('userId') userId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<string[]> {
    try {
      // Check cache first
      const cacheKey = `permissions:${currentUser.tenantId}:${userId}`;
      const cached = await this.cacheService.get<string[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Get from service
      const permissions = await this.permissionsService.getUserPermissions(
        userId,
        currentUser.tenantId,
      );

      // Cache the result
      await this.cacheService.set(cacheKey, permissions, {
        ttl: this.PERMISSIONS_CACHE_TTL,
      });

      return permissions;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get permissions');
    }
  }

  /**
   * Get current user's permissions
   * Returns all permissions for the authenticated user
   * Cached for 15 minutes
   */
  @Query(() => [String], {
    description: 'Get permissions for current user',
  })
  async myPermissions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<string[]> {
    try {
      // Check cache first
      const cacheKey = `permissions:${user.tenantId}:${user.id}`;
      const cached = await this.cacheService.get<string[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Get from service
      const permissions = await this.permissionsService.getUserPermissions(
        user.id,
        user.tenantId,
      );

      // Cache the result
      await this.cacheService.set(cacheKey, permissions, {
        ttl: this.PERMISSIONS_CACHE_TTL,
      });

      return permissions;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get permissions');
    }
  }

  /**
   * Get all available roles
   * Returns list of roles with their permissions
   */
  @Query(() => [Role], {
    description: 'Get all available roles',
  })
  @UseGuards(PermissionsGuard)
  @Permissions('roles:read')
  async getRoles(): Promise<Role[]> {
    try {
      // Get all role names from the enum
      const roles = ['super_admin', 'tenant_admin', 'manager', 'employee', 'customer', 'readonly'];
      
      return roles.map(role => ({
        name: role,
        permissions: this.permissionsService.getRolePermissions(role as any),
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get roles');
    }
  }

  /**
   * Get permissions for a specific role
   * Returns the permissions associated with a role
   */
  @Query(() => [String], {
    description: 'Get permissions for a specific role',
  })
  @UseGuards(PermissionsGuard)
  @Permissions('roles:read')
  async getRolePermissions(
    @Args('role') role: string,
  ): Promise<string[]> {
    try {
      return this.permissionsService.getRolePermissions(role as any);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get role permissions');
    }
  }

  /**
   * Grant a permission to a user
   * Requires permissions:manage permission
   * Invalidates permission cache
   */
  @Mutation(() => MutationResponse, {
    description: 'Grant a permission to a user',
  })
  @UseGuards(PermissionsGuard)
  @Permissions('permissions:manage')
  async grantPermission(
    @Args('input') input: GrantPermissionInput,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MutationResponse> {
    try {
      await this.permissionsService.grantPermission(
        input.userId,
        currentUser.tenantId,
        input.permission,
        currentUser.id,
        {
          ...(input.resource && { resource: input.resource }),
          ...(input.resourceId && { resourceId: input.resourceId }),
          ...(input.expiresAt && { expiresAt: new Date(input.expiresAt) }),
        },
      );

      // Invalidate cache
      const cacheKey = `permissions:${currentUser.tenantId}:${input.userId}`;
      await this.cacheService.del(cacheKey);

      return {
        success: true,
        message: 'Permission granted successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to grant permission',
        errors: [
          {
            message: error.message || 'Failed to grant permission',
            timestamp: new Date(),
          },
        ],
      };
    }
  }

  /**
   * Revoke a permission from a user
   * Requires permissions:manage permission
   * Invalidates permission cache
   */
  @Mutation(() => MutationResponse, {
    description: 'Revoke a permission from a user',
  })
  @UseGuards(PermissionsGuard)
  @Permissions('permissions:manage')
  async revokePermission(
    @Args('input') input: RevokePermissionInput,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MutationResponse> {
    try {
      await this.permissionsService.revokePermission(
        input.userId,
        currentUser.tenantId,
        input.permission,
        input.resource,
        input.resourceId,
      );

      // Invalidate cache
      const cacheKey = `permissions:${currentUser.tenantId}:${input.userId}`;
      await this.cacheService.del(cacheKey);

      return {
        success: true,
        message: 'Permission revoked successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to revoke permission',
        errors: [
          {
            message: error.message || 'Failed to revoke permission',
            timestamp: new Date(),
          },
        ],
      };
    }
  }

  /**
   * Assign a role to a user
   * Requires roles:manage permission AND admin/tenant_admin role
   * Invalidates permission cache
   */
  @Mutation(() => MutationResponse, {
    description: 'Assign a role to a user',
  })
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'tenant_admin')
  @Permissions('roles:manage')
  async assignRole(
    @Args('input') input: AssignRoleInput,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MutationResponse> {
    try {
      // Update user role in database
      const db = this.permissionsService['drizzleService'].getDb();
      const { users } = await import('../../database/schema/user.schema');
      const { eq, and } = await import('drizzle-orm');

      await db
        .update(users)
        .set({
          role: input.role as any,
          updatedAt: new Date(),
          updatedBy: currentUser.id,
        })
        .where(and(
          eq(users.id, input.userId),
          eq(users.tenantId, currentUser.tenantId)
        ));

      // Invalidate cache
      const cacheKey = `permissions:${currentUser.tenantId}:${input.userId}`;
      await this.cacheService.del(cacheKey);

      return {
        success: true,
        message: 'Role assigned successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to assign role',
        errors: [
          {
            message: error.message || 'Failed to assign role',
            timestamp: new Date(),
          },
        ],
      };
    }
  }

  /**
   * Check if user has a specific permission
   * Useful for UI permission checks
   */
  @Query(() => Boolean, {
    description: 'Check if user has a specific permission',
  })
  async hasPermission(
    @Args('userId') userId: string,
    @Args('permission') permission: string,
    @Args('resource', { nullable: true }) resource?: string,
    @Args('resourceId', { nullable: true }) resourceId?: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ): Promise<boolean> {
    try {
      const tenantId = currentUser?.tenantId || '';
      return await this.permissionsService.hasPermission(
        userId,
        tenantId,
        permission,
        resource,
        resourceId,
      );
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Get all available permissions
   * Returns list of all permission strings in the system
   */
  @Query(() => [String], {
    description: 'Get all available permissions',
  })
  @UseGuards(PermissionsGuard)
  @Permissions('permissions:read')
  async getAllPermissions(): Promise<string[]> {
    try {
      return this.permissionsService.getAllPermissions();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get all permissions');
    }
  }
}
