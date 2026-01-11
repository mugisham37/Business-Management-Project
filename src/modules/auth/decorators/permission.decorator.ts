import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to require specific permissions for a route
 * @param permissions Array of permission strings required
 */
export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata('permissions', permissions);

/**
 * Decorator to require a single permission for a route
 * @param permission Permission string required
 * @param resource Optional resource type
 * @param resourceId Optional specific resource ID
 */
export const RequirePermission = (
  permission: string,
  resource?: string,
  resourceId?: string
) => SetMetadata('permission', { permission, resource, resourceId });