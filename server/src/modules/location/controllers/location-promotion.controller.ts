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
import { LocationPromotionService } from '../services/location-promotion.service';
import { LocationPromotion } from '../entities/location-promotion.entity';
import {
  CreateLocationPromotionDto,
  UpdateLocationPromotionDto,
  LocationPromotionQueryDto,
  ApplyPromotionDto,
  PromotionApplicationResultDto,
} from '../dto/location-promotion.dto';

@Controller('api/v1/locations/:locationId/promotions')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('multi-location-operations')
@ApiBearerAuth()
@ApiTags('Location Promotions')
export class LocationPromotionController {
  constructor(
    private readonly locationPromotionService: LocationPromotionService,
  ) {}

  @Post()
  @RequirePermission('locations:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new promotion for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 201, 
    description: 'Promotion created successfully',
    type: LocationPromotion,
  })
  async createPromotion(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() createDto: CreateLocationPromotionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationPromotion> {
    return this.locationPromotionService.createPromotion(
      tenantId,
      locationId,
      createDto,
      user.id,
    );
  }

  @Get()
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get promotions for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Promotions retrieved successfully',
  })
  async getPromotions(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query() query: LocationPromotionQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ promotions: LocationPromotion[]; total: number }> {
    return this.locationPromotionService.findPromotions(tenantId, locationId, query);
  }

  @Get('applicable')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get applicable promotions for product or customer' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Applicable promotions retrieved successfully',
  })
  async getApplicablePromotions(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @CurrentTenant() tenantId: string,
    @Query('productId') productId?: string,
    @Query('customerId') customerId?: string,
  ): Promise<LocationPromotion[]> {
    return this.locationPromotionService.getApplicablePromotions(
      tenantId,
      locationId,
      productId,
      customerId,
    );
  }

  @Get(':promotionId')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get promotion by ID' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'promotionId', description: 'Promotion ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Promotion retrieved successfully',
    type: LocationPromotion,
  })
  async getPromotion(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('promotionId', ParseUUIDPipe) promotionId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationPromotion> {
    const promotion = await this.locationPromotionService.findById(tenantId, locationId, promotionId);
    if (!promotion) {
      throw new Error('Promotion not found');
    }
    return promotion;
  }

  @Put(':promotionId')
  @RequirePermission('locations:update')
  @ApiOperation({ summary: 'Update promotion' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'promotionId', description: 'Promotion ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Promotion updated successfully',
    type: LocationPromotion,
  })
  async updatePromotion(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('promotionId', ParseUUIDPipe) promotionId: string,
    @Body() updateDto: UpdateLocationPromotionDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationPromotion> {
    return this.locationPromotionService.updatePromotion(
      tenantId,
      locationId,
      promotionId,
      updateDto,
      user.id,
    );
  }

  @Delete(':promotionId')
  @RequirePermission('locations:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete promotion' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'promotionId', description: 'Promotion ID' })
  @ApiResponse({ 
    status: 204, 
    description: 'Promotion deleted successfully',
  })
  async deletePromotion(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('promotionId', ParseUUIDPipe) promotionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    await this.locationPromotionService.deletePromotion(
      tenantId,
      locationId,
      promotionId,
      user.id,
    );
  }

  @Post('apply')
  @RequirePermission('locations:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply promotion to cart items' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Promotion applied successfully',
    type: PromotionApplicationResultDto,
  })
  async applyPromotion(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() applyDto: ApplyPromotionDto,
    @CurrentTenant() tenantId: string,
  ): Promise<PromotionApplicationResultDto> {
    return this.locationPromotionService.applyPromotion(
      tenantId,
      locationId,
      applyDto,
    );
  }

  @Get('code/:promotionCode')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get promotion by code' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'promotionCode', description: 'Promotion code' })
  @ApiResponse({ 
    status: 200, 
    description: 'Promotion retrieved successfully',
    type: LocationPromotion,
  })
  async getPromotionByCode(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('promotionCode') promotionCode: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationPromotion> {
    const promotion = await this.locationPromotionService.findByCode(tenantId, locationId, promotionCode);
    if (!promotion) {
      throw new Error('Promotion not found');
    }
    return promotion;
  }
}