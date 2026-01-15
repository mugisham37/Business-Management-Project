import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../services/permissions.service';
import { AuthenticatedUser } from '../interfaces/auth.interface';

export interface PermissionRequirement {
  permission: string;
  resource?: string;
  resourceId?: string;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermission = this.reflector.getAllAndOverride<PermissionRequirement>('permission', [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRole = this.reflector.getAllAndOverride<string>('role', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions are required, allow access
    if (!requiredPermissions && !requiredPermission && !requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check role requirement
    if (requiredRole && user.role !== requiredRole) {
      // Check if user has a higher role
      const hasHigherRole = this.permissionsService.isRoleHigherThan(user.role, requiredRole as any);
      if (!hasHigherRole) {
        throw new ForbiddenException(`Required role: ${requiredRole}`);
      }
    }

    // Check single permission requirement
    if (requiredPermission) {
      const hasPermission = await this.permissionsService.hasPermission(
        user.id,
        user.tenantId,
        requiredPermission.permission,
        requiredPermission.resource,
        requiredPermission.resourceId
      );

      if (!hasPermission) {
        throw new ForbiddenException(`Missing permission: ${requiredPermission.permission}`);
      }
    }

    // Check multiple permissions requirement (user must have ALL permissions)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAllPermissions = await this.permissionsService.hasAllPermissions(
        user.id,
        user.tenantId,
        requiredPermissions
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException(`Missing required permissions: ${requiredPermissions.join(', ')}`);
      }
    }

    return true;
  }
}