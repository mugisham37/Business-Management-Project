import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param, 
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { PermissionsService } from '../services/permissions.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { 
  CurrentUser, 
  CurrentTenant,
  RequirePermissions,
  RequireAdmin,
} from '../decorators/auth.decorators';
import { AuthenticatedUser } from '../interfaces/auth.interface';

class GrantPermissionDto {
  userId!: string;
  permission!: string;
  resource?: string;
  resourceId?: string;
  expiresAt?: Date;
  conditions?: Record<string, any>;
}

class RevokePermissionDto {
  userId!: string;
  permission!: string;
  resource?: string;
  resourceId?: string;
}

@ApiTags('Permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('user/:userId')
  @RequirePermissions('users:read', 'permissions:read')
  @ApiOperation({ 
    summary: 'Get user permissions',
    description: 'Get all permissions for a specific user',
  })
  @ApiParam({ name: 'userId', type: 'string', description: 'User ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'User permissions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        permissions: { 
          type: 'array',
          items: { type: 'string' }
        },
      },
    },
  })
  async getUserPermissions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ userId: string; permissions: string[] }> {
    const permissions = await this.permissionsService.getUserPermissions(userId, tenantId);
    return { userId, permissions };
  }

  @Get('check/:userId/:permission')
  @RequirePermissions('users:read', 'permissions:read')
  @ApiOperation({ 
    summary: 'Check user permission',
    description: 'Check if a user has a specific permission',
  })
  @ApiParam({ name: 'userId', type: 'string', description: 'User ID' })
  @ApiParam({ name: 'permission', type: 'string', description: 'Permission to check' })
  @ApiResponse({ 
    status: 200, 
    description: 'Permission check result',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        permission: { type: 'string' },
        hasPermission: { type: 'boolean' },
      },
    },
  })
  async checkUserPermission(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permission') permission: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ userId: string; permission: string; hasPermission: boolean }> {
    const hasPermission = await this.permissionsService.hasPermission(
      userId,
      tenantId,
      permission
    );
    
    return { userId, permission, hasPermission };
  }

  @Get('my-permissions')
  @ApiOperation({ 
    summary: 'Get current user permissions',
    description: 'Get all permissions for the authenticated user',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Current user permissions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        role: { type: 'string' },
        permissions: { 
          type: 'array',
          items: { type: 'string' }
        },
      },
    },
  })
  async getMyPermissions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ userId: string; role: string; permissions: string[] }> {
    const permissions = await this.permissionsService.getUserPermissions(
      user.id,
      user.tenantId
    );
    
    return { 
      userId: user.id, 
      role: user.role,
      permissions 
    };
  }

  @Get('available')
  @RequireAdmin()
  @ApiOperation({ 
    summary: 'Get all available permissions',
    description: 'Get list of all available permissions in the system',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Available permissions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        permissions: { 
          type: 'array',
          items: { type: 'string' }
        },
      },
    },
  })
  async getAvailablePermissions(): Promise<{ permissions: string[] }> {
    const permissions = this.permissionsService.getAllPermissions();
    return { permissions };
  }

  @Get('role/:role')
  @RequirePermissions('roles:read')
  @ApiOperation({ 
    summary: 'Get role permissions',
    description: 'Get all permissions for a specific role',
  })
  @ApiParam({ name: 'role', type: 'string', description: 'Role name' })
  @ApiResponse({ 
    status: 200, 
    description: 'Role permissions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        role: { type: 'string' },
        permissions: { 
          type: 'array',
          items: { type: 'string' }
        },
      },
    },
  })
  async getRolePermissions(
    @Param('role') role: string,
  ): Promise<{ role: string; permissions: string[] }> {
    const permissions = this.permissionsService.getRolePermissions(role as any);
    return { role, permissions };
  }

  @Post('grant')
  @RequirePermissions('permissions:manage')
  @ApiOperation({ 
    summary: 'Grant permission to user',
    description: 'Grant a specific permission to a user',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Permission granted successfully',
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions',
  })
  async grantPermission(
    @Body() grantDto: GrantPermissionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<{ message: string }> {
    const options: {
      resource?: string;
      resourceId?: string;
      expiresAt?: Date;
      conditions?: Record<string, any>;
    } = {};

    if (grantDto.resource) options.resource = grantDto.resource;
    if (grantDto.resourceId) options.resourceId = grantDto.resourceId;
    if (grantDto.expiresAt) options.expiresAt = grantDto.expiresAt;
    if (grantDto.conditions) options.conditions = grantDto.conditions;

    await this.permissionsService.grantPermission(
      grantDto.userId,
      currentUser.tenantId,
      grantDto.permission,
      currentUser.id,
      options
    );

    return { message: 'Permission granted successfully' };
  }

  @Delete('revoke')
  @RequirePermissions('permissions:manage')
  @ApiOperation({ 
    summary: 'Revoke permission from user',
    description: 'Revoke a specific permission from a user',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Permission revoked successfully',
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions',
  })
  async revokePermission(
    @Body() revokeDto: RevokePermissionDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ message: string }> {
    await this.permissionsService.revokePermission(
      revokeDto.userId,
      tenantId,
      revokeDto.permission,
      revokeDto.resource,
      revokeDto.resourceId
    );

    return { message: 'Permission revoked successfully' };
  }

  @Get('users-with/:permission')
  @RequirePermissions('users:read', 'permissions:read')
  @ApiOperation({ 
    summary: 'Get users with permission',
    description: 'Get all users who have a specific permission',
  })
  @ApiParam({ name: 'permission', type: 'string', description: 'Permission to search for' })
  @ApiResponse({ 
    status: 200, 
    description: 'Users with permission retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        permission: { type: 'string' },
        userIds: { 
          type: 'array',
          items: { type: 'string' }
        },
      },
    },
  })
  async getUsersWithPermission(
    @Param('permission') permission: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ permission: string; userIds: string[] }> {
    const userIds = await this.permissionsService.getUsersWithPermission(
      tenantId,
      permission
    );
    
    return { permission, userIds };
  }
}