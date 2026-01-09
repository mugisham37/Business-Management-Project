import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
} from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';
import { BusinessMetricsService } from '../services/business-metrics.service';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import {
  CreateTenantDto,
  UpdateTenantDto,
  UpdateBusinessMetricsDto,
  TenantQueryDto,
} from '../dto/tenant.dto';
import { Tenant, BusinessTier } from '../entities/tenant.entity';
import { AuthenticatedUser } from '../guards/tenant.guard';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('api/v1/tenants')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantInterceptor)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly businessMetricsService: BusinessMetricsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully', type: Tenant })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Tenant slug already exists' })
  @ApiBody({ type: CreateTenantDto })
  async createTenant(
    @Body() createTenantDto: CreateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant> {
    // Only super admins can create tenants
    if (!user.permissions.includes('tenants:create')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    return this.tenantService.create(createTenantDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tenants with filtering' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  @ApiQuery({ name: 'businessTier', enum: BusinessTier, required: false })
  @ApiQuery({ name: 'subscriptionStatus', required: false })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getTenants(
    @Query() query: TenantQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ tenants: Tenant[]; total: number }> {
    // Only super admins can list all tenants
    if (!user.permissions.includes('tenants:read-all')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    return this.tenantService.findAll(query);
  }

  @Get(':id')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully', type: Tenant })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant> {
    // Users can only access their own tenant or super admins can access any
    if (user.tenantId !== id && !user.permissions.includes('tenants:read-all')) {
      throw new Error('Access denied: Cannot access other tenant data');
    }

    const tenant = await this.tenantService.findById(id);
    if (!tenant) {
      throw new Error(`Tenant with ID '${id}' not found`);
    }

    return tenant;
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get tenant by slug' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved successfully', type: Tenant })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiParam({ name: 'slug', type: 'string' })
  async getTenantBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant> {
    const tenant = await this.tenantService.findBySlug(slug);
    if (!tenant) {
      throw new Error(`Tenant with slug '${slug}' not found`);
    }

    // Users can only access their own tenant or super admins can access any
    if (user.tenantId !== tenant.id && !user.permissions.includes('tenants:read-all')) {
      throw new Error('Access denied: Cannot access other tenant data');
    }

    return tenant;
  }

  @Put(':id')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully', type: Tenant })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateTenantDto })
  async updateTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant> {
    // Users can only update their own tenant or super admins can update any
    if (user.tenantId !== id && !user.permissions.includes('tenants:update-all')) {
      throw new Error('Access denied: Cannot update other tenant data');
    }

    return this.tenantService.update(id, updateTenantDto, user.id);
  }

  @Put(':id/metrics')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Update tenant business metrics' })
  @ApiResponse({ status: 200, description: 'Business metrics updated successfully', type: Tenant })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateBusinessMetricsDto })
  async updateBusinessMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() metricsDto: UpdateBusinessMetricsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Tenant> {
    // Users can only update their own tenant metrics
    if (user.tenantId !== id && !user.permissions.includes('tenants:update-all')) {
      throw new Error('Access denied: Cannot update other tenant metrics');
    }

    return this.tenantService.updateBusinessMetrics(id, metricsDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant' })
  @ApiResponse({ status: 204, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deleteTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // Only super admins can delete tenants
    if (!user.permissions.includes('tenants:delete')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    await this.tenantService.delete(id, user.id);
  }

  @Get(':id/context')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get tenant context for request processing' })
  @ApiResponse({ status: 200, description: 'Tenant context retrieved successfully' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getTenantContext(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    tenant: Tenant;
    businessTier: BusinessTier;
    isActive: boolean;
  }> {
    // Users can only access their own tenant context
    if (user.tenantId !== id && !user.permissions.includes('tenants:read-all')) {
      throw new Error('Access denied: Cannot access other tenant context');
    }

    return this.tenantService.getTenantContext(id);
  }

  @Post('calculate-tier')
  @ApiOperation({ summary: 'Calculate business tier based on metrics' })
  @ApiResponse({ status: 200, description: 'Business tier calculated successfully' })
  @ApiBody({ type: UpdateBusinessMetricsDto })
  calculateBusinessTier(
    @Body() metrics: UpdateBusinessMetricsDto,
  ): { tier: BusinessTier; requirements: any } {
    const tier = this.businessMetricsService.calculateBusinessTier(metrics as any);
    const requirements = this.businessMetricsService.getUpgradeRequirements(tier);
    
    return { tier, requirements };
  }
}