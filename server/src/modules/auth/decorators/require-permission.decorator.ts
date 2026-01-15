import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to require a specific permission for a route
 * @param permission Permission string required
 * @param resource Optional resource type
 * @param resourceId Optional specific resource ID
 */
export const RequirePermission = (
  permission: string,
  resource?: string,
  resourceId?: string
) => SetMetadata('permission', { permission, resource, resourceId });