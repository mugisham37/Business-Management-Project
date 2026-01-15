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
import { FeatureFlagService } from '../services/feature-flag.service';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenantId } from '../decorators/tenant.decorators';
import { AuthenticatedUser } from '../guards/tenant.guard';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  FeatureFlagQueryDto,
  FeatureAccessDto,
  BulkFeatureAccessDto,
  FeatureEvaluationResultDto,
} from '../dto/feature-flag.dto';
import { FeatureFlag, FeatureDefinition } from '../entities/feature-flag.entity';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('api/v1/feature-flags')
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if tenant has access to a specific feature' })
  @ApiResponse({ status: 200, description: 'Feature access result', type: FeatureEvaluationResultDto })
  @ApiBody({ type: FeatureAccessDto })
  async checkFeatureAccess(
    @Body() dto: FeatureAccessDto,
    @CurrentTenantId() tenantId: string,
  ): Promise<FeatureEvaluationResultDto> {
    const hasAccess = await this.featureFlagService.hasFeature(tenantId, dto.featureName);
    
    const featureDefinitions = this.featureFlagService.getFeatureDefinitions();
    const definition = featureDefinitions[dto.featureName];
    
    return {
      featureName: dto.featureName,
      hasAccess,
      reason: hasAccess 
        ? 'Feature is available for your business tier' 
        : 'Feature requires a higher business tier or is disabled',
      ...(definition?.requiredTier && { requiredTier: definition.requiredTier }),
      upgradeRequired: !hasAccess && !!definition?.requiredTier,
    };
  }

  @Post('check-bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check access to multiple features at once' })
  @ApiResponse({ status: 200, description: 'Bulk feature access results', type: [FeatureEvaluationResultDto] })
  @ApiBody({ type: BulkFeatureAccessDto })
  async checkBulkFeatureAccess(
    @Body() dto: BulkFeatureAccessDto,
    @CurrentTenantId() tenantId: string,
  ): Promise<FeatureEvaluationResultDto[]> {
    const results: FeatureEvaluationResultDto[] = [];
    const featureDefinitions = this.featureFlagService.getFeatureDefinitions();

    for (const featureName of dto.featureNames) {
      const hasAccess = await this.featureFlagService.hasFeature(tenantId, featureName);
      const definition = featureDefinitions[featureName];
      
      results.push({
        featureName,
        hasAccess,
        reason: hasAccess 
          ? 'Feature is available for your business tier' 
          : 'Feature requires a higher business tier or is disabled',
        ...(definition?.requiredTier && { requiredTier: definition.requiredTier }),
        upgradeRequired: !hasAccess && !!definition?.requiredTier,
      });
    }

    return results;
  }

  @Get('available')
  @ApiOperation({ summary: 'Get all available features for the tenant' })
  @ApiResponse({ status: 200, description: 'Available features retrieved successfully' })
  async getAvailableFeatures(
    @CurrentTenantId() tenantId: string,
  ): Promise<{
    available: FeatureDefinition[];
    unavailable: FeatureDefinition[];
    upgradeRequired: FeatureDefinition[];
  }> {
    return this.featureFlagService.getAvailableFeatures(tenantId);
  }

  @Get('definitions')
  @ApiOperation({ summary: 'Get all feature definitions' })
  @ApiResponse({ status: 200, description: 'Feature definitions retrieved successfully' })
  getFeatureDefinitions(): Record<string, FeatureDefinition> {
    return this.featureFlagService.getFeatureDefinitions();
  }

  @Get('definitions/category/:category')
  @ApiOperation({ summary: 'Get features by category' })
  @ApiResponse({ status: 200, description: 'Features by category retrieved successfully' })
  @ApiParam({ name: 'category', type: 'string' })
  getFeaturesByCategory(
    @Param('category') category: string,
  ): FeatureDefinition[] {
    return this.featureFlagService.getFeaturesByCategory(category);
  }

  @Post(':featureName/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable a feature for the tenant' })
  @ApiResponse({ status: 200, description: 'Feature enabled successfully', type: FeatureFlag })
  @ApiParam({ name: 'featureName', type: 'string' })
  async enableFeature(
    @Param('featureName') featureName: string,
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FeatureFlag> {
    // Only tenant admins can enable features
    if (!user.permissions.includes('features:manage')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    return this.featureFlagService.setTenantFeatureFlag(tenantId, featureName, true);
  }

  @Post(':featureName/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a feature for the tenant' })
  @ApiResponse({ status: 200, description: 'Feature disabled successfully', type: FeatureFlag })
  @ApiParam({ name: 'featureName', type: 'string' })
  async disableFeature(
    @Param('featureName') featureName: string,
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FeatureFlag> {
    // Only tenant admins can disable features
    if (!user.permissions.includes('features:manage')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    return this.featureFlagService.setTenantFeatureFlag(tenantId, featureName, false);
  }

  @Put(':featureName')
  @ApiOperation({ summary: 'Update feature flag configuration' })
  @ApiResponse({ status: 200, description: 'Feature flag updated successfully', type: FeatureFlag })
  @ApiParam({ name: 'featureName', type: 'string' })
  @ApiBody({ type: UpdateFeatureFlagDto })
  async updateFeatureFlag(
    @Param('featureName') featureName: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FeatureFlag> {
    // Only tenant admins can update feature flags
    if (!user.permissions.includes('features:manage')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    return this.featureFlagService.setTenantFeatureFlag(
      tenantId,
      featureName,
      dto.isEnabled ?? true,
      {
        ...(dto.rolloutPercentage !== undefined && { rolloutPercentage: dto.rolloutPercentage }),
        ...(dto.customRules && { customRules: dto.customRules }),
        ...(dto.status && { status: dto.status }),
      },
    );
  }

  @Delete('cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear feature flag cache for the tenant' })
  @ApiResponse({ status: 204, description: 'Feature flag cache cleared successfully' })
  async clearFeatureCache(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // Only tenant admins can clear cache
    if (!user.permissions.includes('features:manage')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    await this.featureFlagService.invalidateFeatureCache(tenantId);
  }

  @Delete('cache/:featureName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear cache for a specific feature' })
  @ApiResponse({ status: 204, description: 'Feature cache cleared successfully' })
  @ApiParam({ name: 'featureName', type: 'string' })
  async clearFeatureCacheByName(
    @Param('featureName') featureName: string,
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // Only tenant admins can clear cache
    if (!user.permissions.includes('features:manage')) {
      throw new Error('Access denied: Insufficient permissions');
    }

    await this.featureFlagService.invalidateFeatureCache(tenantId, featureName);
  }
}