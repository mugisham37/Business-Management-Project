import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/feature.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorator';
import { CurrentUser } from '../../auth/decorators/user.decorator';
import { FranchiseService } from '../services/franchise.service';
import {
  DealerPortalAccessDto,
  DealerDashboardDto,
  FranchisePerformanceDto,
} from '../dto/franchise.dto';
import { Franchise, FranchisePermission } from '../entities/franchise.entity';

@ApiTags('Dealer Portal')
@Controller('api/v1/dealer-portal')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('multi-location-operations')
@ApiBearerAuth()
export class DealerPortalController {
  constructor(private readonly franchiseService: FranchiseService) {}

  @Get('access/:franchiseId')
  @RequirePermission('dealer-portal:access')
  @ApiOperation({ summary: 'Validate dealer portal access' })
  @ApiResponse({ status: 200, description: 'Access validation successful', type: DealerPortalAccessDto })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiParam({ name: 'franchiseId', description: 'Franchise ID' })
  async validateAccess(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('franchiseId', ParseUUIDPipe) franchiseId: string,
  ): Promise<DealerPortalAccessDto> {
    return this.franchiseService.validateDealerPortalAccess(tenantId, franchiseId, user.id);
  }

  @Get('dashboard/:franchiseId')
  @RequirePermission('dealer-portal:access')
  @ApiOperation({ summary: 'Get dealer dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully', type: DealerDashboardDto })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiParam({ name: 'franchiseId', description: 'Franchise ID' })
  async getDealerDashboard(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('franchiseId', ParseUUIDPipe) franchiseId: string,
  ): Promise<DealerDashboardDto> {
    return this.franchiseService.getDealerDashboard(tenantId, franchiseId, user.id);
  }

  @Get('my-franchises')
  @RequirePermission('dealer-portal:access')
  @ApiOperation({ summary: 'Get user franchises' })
  @ApiResponse({ status: 200, description: 'User franchises retrieved successfully' })
  async getMyFranchises(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{
    franchises: Array<{
      franchise: Franchise;
      permissions: FranchisePermission;
      accessLevel: string;
    }>;
  }> {
    const permissions = await this.franchiseService.getUserFranchisePermissions(tenantId, user.id);
    
    const franchiseData = await Promise.all(
      permissions.map(async (permission) => {
        const franchise = await this.franchiseService.getFranchiseById(tenantId, permission.franchiseId);
        return {
          franchise,
          permissions: permission,
          accessLevel: this.determineAccessLevel(permission),
        };
      })
    );

    return { franchises: franchiseData };
  }

  @Get('performance/:franchiseId')
  @RequirePermission('dealer-portal:access')
  @ApiOperation({ summary: 'Get franchise performance for dealer' })
  @ApiResponse({ status: 200, description: 'Performance data retrieved successfully', type: FranchisePerformanceDto })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiParam({ name: 'franchiseId', description: 'Franchise ID' })
  @ApiQuery({ name: 'period', required: false, description: 'Performance period (monthly, quarterly, yearly)' })
  async getFranchisePerformanceForDealer(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('franchiseId', ParseUUIDPipe) franchiseId: string,
    @Query('period') period: string = 'monthly',
  ): Promise<FranchisePerformanceDto> {
    // Validate access first
    await this.franchiseService.validateDealerPortalAccess(tenantId, franchiseId, user.id);
    
    return this.franchiseService.getFranchisePerformance(tenantId, franchiseId, period);
  }

  @Post('support-request/:franchiseId')
  @RequirePermission('dealer-portal:access')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit support request' })
  @ApiResponse({ status: 201, description: 'Support request submitted successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiParam({ name: 'franchiseId', description: 'Franchise ID' })
  async submitSupportRequest(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('franchiseId', ParseUUIDPipe) franchiseId: string,
    @Body() body: {
      subject: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      category: string;
    },
  ): Promise<{ requestId: string; message: string }> {
    // Validate access first
    await this.franchiseService.validateDealerPortalAccess(tenantId, franchiseId, user.id);

    // TODO: Implement support request creation
    // This would typically integrate with a ticketing system
    const requestId = `SR-${Date.now()}`;

    return {
      requestId,
      message: 'Support request submitted successfully',
    };
  }

  @Get('notifications/:franchiseId')
  @RequirePermission('dealer-portal:access')
  @ApiOperation({ summary: 'Get franchise notifications' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiParam({ name: 'franchiseId', description: 'Franchise ID' })
  @ApiQuery({ name: 'unreadOnly', required: false, description: 'Get only unread notifications' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of notifications' })
  async getFranchiseNotifications(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('franchiseId', ParseUUIDPipe) franchiseId: string,
    @Query('unreadOnly') unreadOnly: boolean = false,
    @Query('limit') limit: number = 50,
  ): Promise<{
    notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: string;
      priority: string;
      isRead: boolean;
      createdAt: Date;
      actionUrl?: string;
    }>;
    unreadCount: number;
  }> {
    // Validate access first
    await this.franchiseService.validateDealerPortalAccess(tenantId, franchiseId, user.id);

    // TODO: Implement notification retrieval
    // This would typically query a notifications table
    const mockNotifications = [
      {
        id: '1',
        title: 'Monthly Performance Report Available',
        message: 'Your monthly performance report for this franchise is now available.',
        type: 'report',
        priority: 'medium',
        isRead: false,
        createdAt: new Date(),
        actionUrl: `/dealer-portal/performance/${franchiseId}`,
      },
      {
        id: '2',
        title: 'Inventory Alert',
        message: 'Low stock alert for 3 products in your inventory.',
        type: 'inventory',
        priority: 'high',
        isRead: false,
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        actionUrl: `/dealer-portal/inventory/${franchiseId}`,
      },
    ];

    const filteredNotifications = unreadOnly 
      ? mockNotifications.filter(n => !n.isRead)
      : mockNotifications;

    return {
      notifications: filteredNotifications.slice(0, limit),
      unreadCount: mockNotifications.filter(n => !n.isRead).length,
    };
  }

  @Post('notifications/:franchiseId/:notificationId/mark-read')
  @RequirePermission('dealer-portal:access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiParam({ name: 'franchiseId', description: 'Franchise ID' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  async markNotificationAsRead(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('franchiseId', ParseUUIDPipe) franchiseId: string,
    @Param('notificationId') notificationId: string,
  ): Promise<{ message: string }> {
    // Validate access first
    await this.franchiseService.validateDealerPortalAccess(tenantId, franchiseId, user.id);

    // TODO: Implement notification update
    // This would typically update the notification status in the database

    return { message: 'Notification marked as read' };
  }

  private determineAccessLevel(permission: FranchisePermission): string {
    if (permission.role === 'owner') return 'full';
    if (permission.role === 'operator') return 'full';
    if (permission.role === 'manager') return 'limited';
    return 'readonly';
  }
}