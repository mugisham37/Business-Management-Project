import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/auth.interface';
import { userRoleEnum } from '../../database/schema/enums';

/**
 * Decorator to mark routes as public (no authentication required)
 */
export const Public = () => SetMetadata('isPublic', true);

/**
 * Decorator to get the current authenticated user from the request
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    return data ? user?.[data] : user;
  },
);

/**
 * Decorator to get the current tenant ID from the authenticated user
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    
    return user?.tenantId;
  },
);

/**
 * Decorator to get the current session ID from the authenticated user
 */
export const CurrentSession = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    
    return user?.sessionId;
  },
);

/**
 * Decorator to get the request IP address
 */
export const IpAddress = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.ip || request.connection.remoteAddress || request.socket.remoteAddress;
  },
);

/**
 * Decorator to get the request User-Agent
 */
export const UserAgent = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.get('User-Agent') || '';
  },
);

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

/**
 * Decorator to require specific roles for a route
 * @param roles Array of role strings required (user must have ONE of these roles)
 */
export const RequireRoles = (...roles: string[]) => 
  SetMetadata('roles', roles);

/**
 * Decorator to require a specific role for a route
 * @param role Role string required
 */
export const RequireRole = (role: typeof userRoleEnum.enumValues[number]) => 
  SetMetadata('role', role);

/**
 * Decorator to require tenant admin role or higher
 */
export const RequireAdmin = () => RequireRole('tenant_admin');

/**
 * Decorator to require manager role or higher
 */
export const RequireManager = () => RequireRole('manager');

/**
 * Decorator to require employee role or higher (excludes customer and readonly)
 */
export const RequireEmployee = () => RequireRole('employee');