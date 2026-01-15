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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission, CurrentUser, CurrentTenant } from '../../auth/decorators/auth.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { LocationPricingService } from '../services/location-pricing.service';
import { LocationPricingRule } from '../entities/location-pricing-rule.entity';
import {
  CreateLocationPricingRuleDto,
  UpdateLocationPricingRuleDto,
  LocationPricingQueryDto,
  CalculatePriceDto,
  PriceCalculationResultDto,
} from '../dto/location-pricing.dto';

@Controller('api/v1/locations/:locationId/pricing')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('multi-location-operations')
@ApiBearerAuth()
@ApiTags('Location Pricing')
export class LocationPricingController {
  constructor(
    private readonly locationPricingService: LocationPricingService,
  ) {}

  @Post('rules')
  @RequirePermission('locations:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new pricing rule for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 201, 
    description: 'Pricing rule created successfully',
    type: LocationPricingRule,
  })
  async createPricingRule(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() createDto: CreateLocationPricingRuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationPricingRule> {
    return this.locationPricingService.createPricingRule(
      tenantId,
      locationId,
      createDto,
      user.id,
    );
  }

  @Get('rules')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get pricing rules for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Pricing rules retrieved successfully',
  })
  async getPricingRules(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query() query: LocationPricingQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ rules: LocationPricingRule[]; total: number }> {
    return this.locationPricingService.findPricingRules(tenantId, locationId, query);
  }

  @Get('rules/:ruleId')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get pricing rule by ID' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'ruleId', description: 'Pricing rule ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Pricing rule retrieved successfully',
    type: LocationPricingRule,
  })
  async getPricingRule(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationPricingRule> {
    const rule = await this.locationPricingService.findById(tenantId, locationId, ruleId);
    if (!rule) {
      throw new Error('Pricing rule not found');
    }
    return rule;
  }

  @Put('rules/:ruleId')
  @RequirePermission('locations:update')
  @ApiOperation({ summary: 'Update pricing rule' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'ruleId', description: 'Pricing rule ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Pricing rule updated successfully',
    type: LocationPricingRule,
  })
  async updatePricingRule(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() updateDto: UpdateLocationPricingRuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationPricingRule> {
    return this.locationPricingService.updatePricingRule(
      tenantId,
      locationId,
      ruleId,
      updateDto,
      user.id,
    );
  }

  @Delete('rules/:ruleId')
  @RequirePermission('locations:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete pricing rule' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'ruleId', description: 'Pricing rule ID' })
  @ApiResponse({ 
    status: 204, 
    description: 'Pricing rule deleted successfully',
  })
  async deletePricingRule(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    await this.locationPricingService.deletePricingRule(
      tenantId,
      locationId,
      ruleId,
      user.id,
    );
  }

  @Post('calculate')
  @RequirePermission('locations:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate price for product with applicable rules' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Price calculated successfully',
    type: PriceCalculationResultDto,
  })
  async calculatePrice(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() calculateDto: CalculatePriceDto & { basePrice: number },
    @CurrentTenant() tenantId: string,
  ): Promise<PriceCalculationResultDto> {
    const { basePrice, ...priceDto } = calculateDto;
    return this.locationPricingService.calculatePrice(
      tenantId,
      locationId,
      priceDto,
      basePrice,
    );
  }
}