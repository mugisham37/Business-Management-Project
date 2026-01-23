/**
 * Permissions Manager
 * Comprehensive permission management with full backend integration
 */

import { apolloClient } from '@/lib/apollo/client';
import {
  GRANT_PERMISSION_MUTATION,
  REVOKE_PERMISSION_MUTATION,
  ASSIGN_ROLE_MUTATION,
  BULK_GRANT_PERMISSIONS_MUTATION,
  BULK_REVOKE_PERMISSIONS_MUTATION,
} from '@/graphql/mutations/auth-complete';
import {
  GET_PERMISSIONS_QUERY,
  MY_PERMISSIONS_QUERY,
  GET_ROLES_QUERY,
  GET_ROLE_PERMISSIONS_QUERY,
  HAS_PERMISSION_QUERY,
  GET_ALL_PERMISSIONS_QUERY,
  GET_DETAILED_PERMISSIONS_QUERY,
  CHECK_PERMISSION_QUERY,
  GET_AVAILABLE_PERMISSIONS_QUERY,
} from '@/graphql/queries/auth-complete';

export interface Permission {
  id: string;
  userId: string;
  permission: string;
  resource?: string;
  resourceId?: string;
  grantedBy?: string;
  grantedAt: Date;
  expiresAt?: Date;
  isInherited: boolean;
}

export interface Role {
  name: string;
  permissions: string[];
}

export interface UserPermissionsResponse {
  permissions: string[];
  role: string;
  detailedPermissions: Permission[];
  includesInherited: boolean;
}

export interface PermissionCheckResponse {
  hasPermission: boolean;
  source: string;
  grantedAt?: Date;
  expiresAt?: Date;
}

export interface BulkPermissionResult {
  userId: string;
  success: boolean;
  message?: string;
}

export interface BulkPermissionResponse {
  success: number;
  failed: number;
  results: BulkPermissionResult[];
}

export interface AvailablePermissionsResponse {
  permissions: string[];
  resources: string[];
  actions: string[];
  roles: Role[];
}

export interface GrantPermissionRequest {
  userId: string;
  permission: string;
  resource?: string;
  resourceId?: string;
  expiresAt?: string;
}

export interface RevokePermissionRequest {
  userId: string;
  permission: string;
  resource?: string;
  resourceId?: string;
}

export interface AssignRoleRequest {
  userId: string;
  role: string;
}

export interface BulkPermissionRequest {
  userIds: string[];
  permissions: string[];
  resource?: string;
  resourceId?: string;
  expiresAt?: string;
}

/**
 * Permissions Manager
 * Handles all permission operations with caching and real-time updates
 */
export class PermissionsManager {
  private permissionCache = new Map<string, { data: string[]; timestamp: number }>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  /**
   * Get permissions for a user
   */
  async getPermissions(userId: string): Promise<string[]> {
    const cacheKey = `permissions:${userId}`;
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const result = await apolloClient.query({
        query: GET_PERMISSIONS_QUERY,
        variables: { userId },
        fetchPolicy: 'network-only',
      });

      const permissions = result.data?.getPermissions || [];
      this.permissionCache.set(cacheKey, {
        data: permissions,
        timestamp: Date.now(),
      });

      return permissions;
    } catch (error) {
      console.error('Failed to get permissions:', error);
      throw error;
    }
  }
  /**
   * Get current user's permissions
   */
  async getMyPermissions(): Promise<string[]> {
    const cacheKey = 'permissions:me';
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const result = await apolloClient.query({
        query: MY_PERMISSIONS_QUERY,
        fetchPolicy: 'network-only',
      });

      const permissions = result.data?.myPermissions || [];
      this.permissionCache.set(cacheKey, {
        data: permissions,
        timestamp: Date.now(),
      });

      return permissions;
    } catch (error) {
      console.error('Failed to get my permissions:', error);
      throw error;
    }
  }

  /**
   * Get all available roles
   */
  async getRoles(): Promise<Role[]> {
    try {
      const result = await apolloClient.query({
        query: GET_ROLES_QUERY,
        fetchPolicy: 'cache-first',
      });

      return result.data?.getRoles || [];
    } catch (error) {
      console.error('Failed to get roles:', error);
      throw error;
    }
  }

  /**
   * Get permissions for a specific role
   */
  async getRolePermissions(role: string): Promise<string[]> {
    try {
      const result = await apolloClient.query({
        query: GET_ROLE_PERMISSIONS_QUERY,
        variables: { role },
        fetchPolicy: 'cache-first',
      });

      return result.data?.getRolePermissions || [];
    } catch (error) {
      console.error('Failed to get role permissions:', error);
      throw error;
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(
    userId: string,
    permission: string,
    resource?: string,
    resourceId?: string
  ): Promise<boolean> {
    try {
      const result = await apolloClient.query({
        query: HAS_PERMISSION_QUERY,
        variables: { userId, permission, resource, resourceId },
        fetchPolicy: 'network-only',
      });

      return result.data?.hasPermission || false;
    } catch (error) {
      console.error('Failed to check permission:', error);
      return false;
    }
  }

  /**
   * Get all available permissions
   */
  async getAllPermissions(): Promise<string[]> {
    try {
      const result = await apolloClient.query({
        query: GET_ALL_PERMISSIONS_QUERY,
        fetchPolicy: 'cache-first',
      });

      return result.data?.getAllPermissions || [];
    } catch (error) {
      console.error('Failed to get all permissions:', error);
      throw error;
    }
  }

  /**
   * Get detailed permissions for a user
   */
  async getDetailedPermissions(userId: string): Promise<UserPermissionsResponse> {
    try {
      const result = await apolloClient.query({
        query: GET_DETAILED_PERMISSIONS_QUERY,
        variables: { userId },
        fetchPolicy: 'network-only',
      });

      return result.data?.getDetailedPermissions || {
        permissions: [],
        role: '',
        detailedPermissions: [],
        includesInherited: false,
      };
    } catch (error) {
      console.error('Failed to get detailed permissions:', error);
      throw error;
    }
  }

  /**
   * Check permission with detailed response
   */
  async checkPermission(
    userId: string,
    permission: string,
    resource?: string,
    resourceId?: string
  ): Promise<PermissionCheckResponse> {
    try {
      const result = await apolloClient.query({
        query: CHECK_PERMISSION_QUERY,
        variables: {
          input: { userId, permission, resource, resourceId },
        },
        fetchPolicy: 'network-only',
      });

      return result.data?.checkPermission || {
        hasPermission: false,
        source: 'none',
      };
    } catch (error) {
      console.error('Failed to check permission:', error);
      return { hasPermission: false, source: 'error' };
    }
  }

  /**
   * Get available permissions, resources, and actions
   */
  async getAvailablePermissions(): Promise<AvailablePermissionsResponse> {
    try {
      const result = await apolloClient.query({
        query: GET_AVAILABLE_PERMISSIONS_QUERY,
        fetchPolicy: 'cache-first',
      });

      return result.data?.getAvailablePermissions || {
        permissions: [],
        resources: [],
        actions: [],
        roles: [],
      };
    } catch (error) {
      console.error('Failed to get available permissions:', error);
      throw error;
    }
  }

  /**
   * Grant permission to user
   */
  async grantPermission(request: GrantPermissionRequest): Promise<void> {
    try {
      const result = await apolloClient.mutate({
        mutation: GRANT_PERMISSION_MUTATION,
        variables: { input: request },
      });

      if (!result.data?.grantPermission?.success) {
        throw new Error(result.data?.grantPermission?.message || 'Failed to grant permission');
      }

      // Clear cache for affected user
      this.clearUserPermissionCache(request.userId);
    } catch (error) {
      console.error('Failed to grant permission:', error);
      throw error;
    }
  }

  /**
   * Revoke permission from user
   */
  async revokePermission(request: RevokePermissionRequest): Promise<void> {
    try {
      const result = await apolloClient.mutate({
        mutation: REVOKE_PERMISSION_MUTATION,
        variables: { input: request },
      });

      if (!result.data?.revokePermission?.success) {
        throw new Error(result.data?.revokePermission?.message || 'Failed to revoke permission');
      }

      // Clear cache for affected user
      this.clearUserPermissionCache(request.userId);
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(request: AssignRoleRequest): Promise<void> {
    try {
      const result = await apolloClient.mutate({
        mutation: ASSIGN_ROLE_MUTATION,
        variables: { input: request },
      });

      if (!result.data?.assignRole?.success) {
        throw new Error(result.data?.assignRole?.message || 'Failed to assign role');
      }

      // Clear cache for affected user
      this.clearUserPermissionCache(request.userId);
    } catch (error) {
      console.error('Failed to assign role:', error);
      throw error;
    }
  }

  /**
   * Bulk grant permissions
   */
  async bulkGrantPermissions(request: BulkPermissionRequest): Promise<BulkPermissionResponse> {
    try {
      const result = await apolloClient.mutate({
        mutation: BULK_GRANT_PERMISSIONS_MUTATION,
        variables: { input: request },
      });

      const response = result.data?.bulkGrantPermissions || {
        success: 0,
        failed: 0,
        results: [],
      };

      // Clear cache for affected users
      request.userIds.forEach(userId => this.clearUserPermissionCache(userId));

      return response;
    } catch (error) {
      console.error('Failed to bulk grant permissions:', error);
      throw error;
    }
  }

  /**
   * Bulk revoke permissions
   */
  async bulkRevokePermissions(request: BulkPermissionRequest): Promise<BulkPermissionResponse> {
    try {
      const result = await apolloClient.mutate({
        mutation: BULK_REVOKE_PERMISSIONS_MUTATION,
        variables: { input: request },
      });

      const response = result.data?.bulkRevokePermissions || {
        success: 0,
        failed: 0,
        results: [],
      };

      // Clear cache for affected users
      request.userIds.forEach(userId => this.clearUserPermissionCache(userId));

      return response;
    } catch (error) {
      console.error('Failed to bulk revoke permissions:', error);
      throw error;
    }
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const userPermissions = await this.getPermissions(userId);
      return permissions.some(permission => 
        this.matchesPermission(userPermissions, permission)
      );
    } catch (error) {
      console.error('Failed to check any permission:', error);
      return false;
    }
  }

  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const userPermissions = await this.getPermissions(userId);
      return permissions.every(permission => 
        this.matchesPermission(userPermissions, permission)
      );
    } catch (error) {
      console.error('Failed to check all permissions:', error);
      return false;
    }
  }

  /**
   * Match permission with wildcard support
   */
  private matchesPermission(userPermissions: string[], requiredPermission: string): boolean {
    return userPermissions.some(userPerm => {
      // Exact match
      if (userPerm === requiredPermission) return true;
      
      // Wildcard match
      if (userPerm.endsWith(':*')) {
        const prefix = userPerm.slice(0, -1);
        return requiredPermission.startsWith(prefix);
      }
      
      return false;
    });
  }

  /**
   * Clear permission cache for user
   */
  private clearUserPermissionCache(userId: string): void {
    this.permissionCache.delete(`permissions:${userId}`);
    this.permissionCache.delete('permissions:me'); // Clear current user cache too
  }

  /**
   * Clear all permission cache
   */
  clearCache(): void {
    this.permissionCache.clear();
  }
}

// Export singleton instance
export const permissionsManager = new PermissionsManager();