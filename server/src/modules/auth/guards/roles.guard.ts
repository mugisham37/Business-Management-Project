import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../services/permissions.service';
import { AuthenticatedUser } from '../interfaces/auth.interface';
import { userRoleEnum } from '../../database/schema/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRole = this.reflector.getAllAndOverride<string>('role', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles && !requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check single role requirement
    if (requiredRole) {
      if (user.role === requiredRole) {
        return true;
      }

      // Check if user has a higher role
      const hasHigherRole = this.permissionsService.isRoleHigherThan(
        user.role,
        requiredRole as typeof userRoleEnum.enumValues[number]
      );

      if (!hasHigherRole) {
        throw new ForbiddenException(`Required role: ${requiredRole}, current role: ${user.role}`);
      }

      return true;
    }

    // Check multiple roles requirement (user must have ONE of the roles)
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.includes(user.role);
      
      if (hasRequiredRole) {
        return true;
      }

      // Check if user has a higher role than any of the required roles
      const hasHigherRole = requiredRoles.some(role => 
        this.permissionsService.isRoleHigherThan(
          user.role,
          role as typeof userRoleEnum.enumValues[number]
        )
      );

      if (!hasHigherRole) {
        throw new ForbiddenException(
          `Required roles: ${requiredRoles.join(', ')}, current role: ${user.role}`
        );
      }
    }

    return true;
  }
}