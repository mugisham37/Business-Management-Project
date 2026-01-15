import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RealtimeService } from '../services/realtime.service';
import { ConnectionManagerService } from '../services/connection-manager.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';

@ApiTags('Real-time')
@Controller('api/v1/realtime')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Get real-time service health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  @RequirePermission('realtime:read')
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date(),
      health: this.connectionManager.getHealth(),
      metrics: this.connectionManager.getMetrics(),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get real-time connection statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @RequirePermission('realtime:read')
  getStats() {
    return this.connectionManager.getSystemStats();
  }

  @Get('connections')
  @ApiOperation({ summary: 'Get current tenant connections' })
  @ApiResponse({ status: 200, description: 'Connections retrieved successfully' })
  @RequirePermission('realtime:read')
  getTenantConnections(@CurrentTenant() tenantId: string) {
    return this.connectionManager.getTenantConnectionDetails(tenantId);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get detailed connection metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  @RequirePermission('realtime:read')
  getMetrics() {
    return {
      metrics: this.connectionManager.getMetrics(),
      trends: this.connectionManager.getConnectionTrends(),
      anomalies: this.connectionManager.detectAnomalies(),
    };
  }

  @Get('health/history')
  @ApiOperation({ summary: 'Get connection health history' })
  @ApiResponse({ status: 200, description: 'Health history retrieved successfully' })
  @RequirePermission('realtime:read')
  getHealthHistory() {
    return this.connectionManager.getHealthHistory();
  }

  @Get('tenant/:tenantId/connections')
  @ApiOperation({ summary: 'Get connections for specific tenant (admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant connections retrieved successfully' })
  @RequirePermission('admin:realtime:read')
  getSpecificTenantConnections(@Param('tenantId') tenantId: string) {
    return this.connectionManager.getTenantConnectionDetails(tenantId);
  }
}