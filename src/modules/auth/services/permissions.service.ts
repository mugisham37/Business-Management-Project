import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { users, userPermissions } from '../../database/schema/user.schema';
import { userRoleEnum } from '../../database/schema/enums';
import { eq, and, inArray, isNull } from 'drizzle-orm';

export interface Permission {
  id: string;
  userId: string;
  permission: string;
  resource?: string;
  resourceId?: string;
  grantedBy?: string;
  grantedAt: Date;
  expiresAt?: Date;
  conditions?: Record<string, any>;
  isInherited: boolean;
}

export interface RolePermissions {
  role: typeof userRoleEnum.enumValues[number];
  permissions: string[];
}

@Injectable()
export class PermissionsService {
  // Define role-based permissions hierarchy
  private readonly rolePermissions: Record<string, string[]> = {
    super_admin: [
      // Platform-wide permissions
      'platform:*',
      'tenants:*',
      'users:*',
      'system:*',
    ],
    tenant_admin: [
      // Tenant-wide permissions
      'tenant:manage',
      'users:create',
      'users:read',
      'users:update',
      'users:delete',
      'roles:manage',
      'permissions:manage',
      'settings:manage',
      'reports:read',
      'analytics:read',
      'pos:*',
      'inventory:*',
      'customers:*',
      'employees:*',
      'financial:*',
      'suppliers:*',
    ],
    manager: [
      // Management permissions
      'users:read',
      'users:update',
      'employees:manage',
      'reports:read',
      'analytics:read',
      'pos:*',
      'inventory:manage',
      'customers:manage',
      'financial:read',
      'suppliers:read',
    ],
    employee: [
      // Basic employee permissions
      'pos:create',
      'pos:read',
      'inventory:read',
      'customers:read',
      'customers:create',
      'customers:update',
      'profile:read',
      'profile:update',
    ],
    customer: [
      // Customer permissions
      'profile:read',
      'profile:update',
      'orders:read',
      'loyalty:read',
    ],
    readonly: [
      // Read-only permissions
      'pos:read',
      'inventory:read',
      'customers:read',
      'reports:read',
    ],
  };

  constructor(private readonly drizzleService: DrizzleService) {}

  /**
   * Get all permissions for a user (role-based + custom permissions)
   */
  async getUserPermissions(userId: string, tenantId: string): Promise<string[]> {
    const db = this.drizzleService.getDb();

    // Get user with role
    const [user] = await db
      .select({
        role: users.role,
        permissions: users.permissions,
        customPermissions: users.customPermissions,
      })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!user) {
      return [];
    }

    // Get role-based permissions
    const rolePermissions = this.getRolePermissions(user.role);

    // Get custom permissions from user record
    const userCustomPermissions = Array.isArray(user.permissions) ? user.permissions : [];

    // Get granular permissions from userPermissions table
    const granularPermissions = await db
      .select({
        permission: userPermissions.permission,
        resource: userPermissions.resource,
        resourceId: userPermissions.resourceId,
        expiresAt: userPermissions.expiresAt,
      })
      .from(userPermissions)
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.tenantId, tenantId)
      ));

    // Filter out expired permissions and format granular permissions
    const validGranularPermissions = granularPermissions
      .filter(p => !p.expiresAt || p.expiresAt > new Date())
      .map(p => {
        if (p.resource && p.resourceId) {
          return `${p.permission}:${p.resource}:${p.resourceId}`;
        } else if (p.resource) {
          return `${p.permission}:${p.resource}`;
        }
        return p.permission;
      });

    // Combine all permissions and remove duplicates
    const allPermissions = [
      ...rolePermissions,
      ...userCustomPermissions,
      ...validGranularPermissions,
    ];

    return [...new Set(allPermissions)];
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: string,
    tenantId: string,
    permission: string,
    resource?: string,
    resourceId?: string
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId, tenantId);

    // Check for exact permission match
    const permissionToCheck = this.formatPermission(permission, resource, resourceId);
    if (userPermissions.includes(permissionToCheck)) {
      return true;
    }

    // Check for wildcard permissions
    const wildcardChecks = [
      `${permission}:*`,
      resource ? `${permission}:${resource}:*` : null,
      `*:${resource}:${resourceId}`,
      `*:${resource}:*`,
      '*',
    ].filter(Boolean);

    return wildcardChecks.some(wildcard => userPermissions.includes(wildcard!));
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(
    userId: string,
    tenantId: string,
    permissions: string[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, tenantId, permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has all of the specified permissions
   */
  async hasAllPermissions(
    userId: string,
    tenantId: string,
    permissions: string[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, tenantId, permission))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Grant a permission to a user
   */
  async grantPermission(
    userId: string,
    tenantId: string,
    permission: string,
    grantedBy: string,
    options?: {
      resource?: string;
      resourceId?: string;
      expiresAt?: Date;
      conditions?: Record<string, any>;
    }
  ): Promise<void> {
    const db = this.drizzleService.getDb();

    await db
      .insert(userPermissions)
      .values({
        tenantId,
        userId,
        permission,
        resource: options?.resource,
        resourceId: options?.resourceId,
        grantedBy,
        expiresAt: options?.expiresAt,
        conditions: options?.conditions || {},
        isInherited: false,
        createdBy: grantedBy,
        updatedBy: grantedBy,
      })
      .onConflictDoUpdate({
        target: [
          userPermissions.userId,
          userPermissions.permission,
          userPermissions.resource,
          userPermissions.resourceId,
        ],
        set: {
          grantedBy,
          grantedAt: new Date(),
          expiresAt: options?.expiresAt,
          conditions: options?.conditions || {},
          updatedAt: new Date(),
          updatedBy: grantedBy,
        },
      });
  }

  /**
   * Revoke a permission from a user
   */
  async revokePermission(
    userId: string,
    tenantId: string,
    permission: string,
    resource?: string,
    resourceId?: string
  ): Promise<void> {
    const db = this.drizzleService.getDb();

    await db
      .delete(userPermissions)
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.tenantId, tenantId),
        eq(userPermissions.permission, permission),
        resource ? eq(userPermissions.resource, resource) : isNull(userPermissions.resource),
        resourceId ? eq(userPermissions.resourceId, resourceId) : isNull(userPermissions.resourceId)
      ));
  }

  /**
   * Get role-based permissions
   */
  getRolePermissions(role: typeof userRoleEnum.enumValues[number]): string[] {
    return this.rolePermissions[role] || [];
  }

  /**
   * Get all available permissions
   */
  getAllPermissions(): string[] {
    const allPermissions = new Set<string>();
    
    Object.values(this.rolePermissions).forEach(permissions => {
      permissions.forEach(permission => allPermissions.add(permission));
    });

    return Array.from(allPermissions);
  }

  /**
   * Check if a role has higher privileges than another role
   */
  isRoleHigherThan(
    role1: typeof userRoleEnum.enumValues[number],
    role2: typeof userRoleEnum.enumValues[number]
  ): boolean {
    const roleHierarchy = {
      super_admin: 6,
      tenant_admin: 5,
      manager: 4,
      employee: 3,
      customer: 2,
      readonly: 1,
    };

    return (roleHierarchy[role1] || 0) > (roleHierarchy[role2] || 0);
  }

  /**
   * Get users with a specific permission
   */
  async getUsersWithPermission(
    tenantId: string,
    permission: string,
    resource?: string,
    resourceId?: string
  ): Promise<string[]> {
    const db = this.drizzleService.getDb();

    // Get users with the permission directly granted
    const directPermissions = await db
      .select({ userId: userPermissions.userId })
      .from(userPermissions)
      .where(and(
        eq(userPermissions.tenantId, tenantId),
        eq(userPermissions.permission, permission),
        resource ? eq(userPermissions.resource, resource) : isNull(userPermissions.resource),
        resourceId ? eq(userPermissions.resourceId, resourceId) : isNull(userPermissions.resourceId)
      ));

    // Get users with roles that include this permission
    const rolesWithPermission = Object.entries(this.rolePermissions)
      .filter(([_, permissions]) => 
        permissions.includes(permission) || 
        permissions.includes(`${permission}:*`) ||
        permissions.includes('*')
      )
      .map(([role]) => role);

    const roleBasedUsers = rolesWithPermission.length > 0 
      ? await db
          .select({ userId: users.id })
          .from(users)
          .where(and(
            eq(users.tenantId, tenantId),
            eq(users.isActive, true),
            inArray(users.role, rolesWithPermission as any)
          ))
      : [];

    // Combine and deduplicate
    const allUserIds = [
      ...directPermissions.map(p => p.userId),
      ...roleBasedUsers.map(u => u.userId),
    ];

    return [...new Set(allUserIds)];
  }

  /**
   * Format permission string
   */
  private formatPermission(permission: string, resource?: string, resourceId?: string): string {
    if (resource && resourceId) {
      return `${permission}:${resource}:${resourceId}`;
    } else if (resource) {
      return `${permission}:${resource}`;
    }
    return permission;
  }
}