import { SetMetadata } from '@nestjs/common';
import { userRoleEnum } from '../../database/schema/enums';

/**
 * Roles decorator
 * Marks resolvers/queries that require specific user roles
 * Used with RolesGuard to enforce role-based access control
 * 
 * Usage:
 * @Roles('tenant_admin', 'super_admin')
 * async createUser() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
