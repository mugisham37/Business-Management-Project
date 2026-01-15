import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { TenantMetricsTrackingService } from '../services/tenant-metrics-tracking.service';
import { BusinessMetricsService } from '../services/business-metrics.service';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenantId } from '../decorators/tenant.decorators';
import { AuthenticatedUser } from '../guards/tenant.guard';
import { BusinessMetrics, BusinessTier } from '../entities/tenant.entity';

export class MetricsUpdateDto {
  @ApiProperty({ description: 'Event type', enum: ['transaction', 'employee', 'location', 'revenue'] })
  eventType!: 'transaction' | 'employee' | 'location' | 'revenue';

  @ApiProperty({ description: 'Event data' })
  data!: any;
}

export class MetricsHistoryQueryDto {
  @ApiProperty({ description: 'Start date for history query' })
  startDate!: string;

  @ApiProperty({ description: 'End date for history query' })
  endDate!: string;
}

@ApiTags('Tenant Metrics')
@ApiBearerAuth()
@Controller('api/v1/tenant-metrics')
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
export class TenantMetricsController {
  constructor(
    private readonly metricsTrackingService: TenantMetricsTrackingService,
    private readonly businessMetricsService: BusinessMetricsService,
  ) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current real-time metrics for the tenant' })
  @ApiResponse({ status: 200, description: 'Current metrics retrieved successfully' })
  async getCurrentMetrics(
    @CurrentTenantId() tenantId: string,
  ): Promise<BusinessMetrics> {
    return this.metricsTrackingService.getRealTimeMetrics(tenantId);
  }

  @Post('recalculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force recalculation of tenant metrics' })
  @ApiResponse({ status: 200, description: 'Metrics recalculated successfully' })
  async recalculateMetrics(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BusinessMetrics> {
    // Only tenant admins can force recalculation
    if (!user.permissions.includes('metrics:manage')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    return this.metricsTrackingService.recalculateMetrics(tenantId);
  }

  @Get('tier-progression')
  @ApiOperation({ summary: 'Get tier progression analytics' })
  @ApiResponse({ status: 200, description: 'Tier progression retrieved successfully' })
  async getTierProgression(
    @CurrentTenantId() tenantId: string,
  ): Promise<{
    currentTier: BusinessTier;
    nextTier: BusinessTier | null;
    progress: number;
    requirements: any;
    recommendations: string[];
  }> {
    return this.metricsTrackingService.getTierProgression(tenantId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get metrics history for a date range' })
  @ApiResponse({ status: 200, description: 'Metrics history retrieved successfully' })
  @ApiQuery({ name: 'startDate', type: 'string', description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', type: 'string', description: 'End date (ISO string)' })
  async getMetricsHistory(
    @CurrentTenantId() tenantId: string,
    @Query() query: MetricsHistoryQueryDto,
  ): Promise<Array<{ date: Date; metrics: BusinessMetrics; tier: BusinessTier }>> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    return this.metricsTrackingService.getMetricsHistory(tenantId, startDate, endDate);
  }

  @Get('tier-benefits/:tier')
  @ApiOperation({ summary: 'Get benefits and features for a specific business tier' })
  @ApiResponse({ status: 200, description: 'Tier benefits retrieved successfully' })
  @ApiParam({ name: 'tier', enum: BusinessTier })
  getTierBenefits(
    @Param('tier') tier: BusinessTier,
  ): {
    features: string[];
    limits: Record<string, number>;
    description: string;
  } {
    return this.businessMetricsService.getTierBenefits(tier);
  }

  @Get('upgrade-requirements')
  @ApiOperation({ summary: 'Get upgrade requirements for the next tier' })
  @ApiResponse({ status: 200, description: 'Upgrade requirements retrieved successfully' })
  async getUpgradeRequirements(
    @CurrentTenantId() tenantId: string,
  ): Promise<{
    nextTier: BusinessTier | null;
    requirements: any;
    missingCriteria: string[];
    recommendations: string[];
  }> {
    const metrics = await this.metricsTrackingService.getRealTimeMetrics(tenantId);
    const currentTier = this.businessMetricsService.calculateBusinessTier(metrics);
    const upgradeInfo = this.businessMetricsService.getUpgradeRequirements(currentTier);
    const recommendations = this.businessMetricsService.getRecommendedActions(metrics, currentTier);

    return {
      ...upgradeInfo,
      recommendations,
    };
  }

  @Get('tier-progress')
  @ApiOperation({ summary: 'Get progress toward next tier' })
  @ApiResponse({ status: 200, description: 'Tier progress retrieved successfully' })
  async getTierProgress(
    @CurrentTenantId() tenantId: string,
  ): Promise<{
    currentTierProgress: number;
    nextTierProgress: number;
    currentTier: BusinessTier;
  }> {
    const metrics = await this.metricsTrackingService.getRealTimeMetrics(tenantId);
    const currentTier = this.businessMetricsService.calculateBusinessTier(metrics);
    const progress = this.businessMetricsService.calculateTierProgress(metrics, currentTier);

    return {
      ...progress,
      currentTier,
    };
  }

  @Post('track-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track a metrics update event (internal use)' })
  @ApiResponse({ status: 200, description: 'Metrics update tracked successfully' })
  @ApiBody({ type: MetricsUpdateDto })
  async trackMetricsUpdate(
    @Body() dto: MetricsUpdateDto,
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    // Only system or tenant admins can track updates
    if (!user.permissions.includes('metrics:track')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    await this.metricsTrackingService.trackMetricsUpdate({
      tenantId,
      eventType: dto.eventType,
      data: dto.data,
      timestamp: new Date(),
    });

    return { success: true };
  }

  @Get('validation/:employeeCount/:locationCount/:monthlyTransactionVolume/:monthlyRevenue')
  @ApiOperation({ summary: 'Validate business metrics and get calculated tier' })
  @ApiResponse({ status: 200, description: 'Metrics validation completed' })
  @ApiParam({ name: 'employeeCount', type: 'number' })
  @ApiParam({ name: 'locationCount', type: 'number' })
  @ApiParam({ name: 'monthlyTransactionVolume', type: 'number' })
  @ApiParam({ name: 'monthlyRevenue', type: 'number' })
  validateMetrics(
    @Param('employeeCount') employeeCount: number,
    @Param('locationCount') locationCount: number,
    @Param('monthlyTransactionVolume') monthlyTransactionVolume: number,
    @Param('monthlyRevenue') monthlyRevenue: number,
  ): {
    isValid: boolean;
    errors: string[];
    calculatedTier: BusinessTier;
    tierBenefits: any;
  } {
    const metrics = {
      employeeCount: Number(employeeCount),
      locationCount: Number(locationCount),
      monthlyTransactionVolume: Number(monthlyTransactionVolume),
      monthlyRevenue: Number(monthlyRevenue),
    };

    const validation = this.businessMetricsService.validateMetrics(metrics);
    const calculatedTier = this.businessMetricsService.calculateBusinessTier(metrics);
    const tierBenefits = this.businessMetricsService.getTierBenefits(calculatedTier);

    return {
      ...validation,
      calculatedTier,
      tierBenefits,
    };
  }
}