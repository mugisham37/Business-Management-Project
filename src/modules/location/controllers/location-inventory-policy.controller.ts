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
import { LocationInventoryPolicyService } from '../services/location-inventory-policy.service';
import { LocationInventoryPolicy } from '../entities/location-inventory-policy.entity';
import {
  CreateLocationInventoryPolicyDto,
  UpdateLocationInventoryPolicyDto,
  LocationInventoryPolicyQueryDto,
  InventoryRecommendationDto,
  BulkInventoryPolicyUpdateDto,
} from '../dto/location-inventory-policy.dto';

@Controller('api/v1/locations/:locationId/inventory-policies')
@UseGuards(AuthGuard('jwt'), TenantGuard, FeatureGuard)
@RequireFeature('multi-location-operations')
@ApiBearerAuth()
@ApiTags('Location Inventory Policies')
export class LocationInventoryPolicyController {
  constructor(
    private readonly locationInventoryPolicyService: LocationInventoryPolicyService,
  ) {}

  @Post()
  @RequirePermission('locations:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new inventory policy for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 201, 
    description: 'Inventory policy created successfully',
    type: LocationInventoryPolicy,
  })
  async createInventoryPolicy(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() createDto: CreateLocationInventoryPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationInventoryPolicy> {
    return this.locationInventoryPolicyService.createInventoryPolicy(
      tenantId,
      locationId,
      createDto,
      user.id,
    );
  }

  @Get()
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get inventory policies for location' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory policies retrieved successfully',
  })
  async getInventoryPolicies(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query() query: LocationInventoryPolicyQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{ policies: LocationInventoryPolicy[]; total: number }> {
    return this.locationInventoryPolicyService.findInventoryPolicies(tenantId, locationId, query);
  }

  @Get(':policyId')
  @RequirePermission('locations:read')
  @ApiOperation({ summary: 'Get inventory policy by ID' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'policyId', description: 'Inventory policy ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory policy retrieved successfully',
    type: LocationInventoryPolicy,
  })
  async getInventoryPolicy(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationInventoryPolicy> {
    const policy = await this.locationInventoryPolicyService.findById(tenantId, locationId, policyId);
    if (!policy) {
      throw new Error('Inventory policy not found');
    }
    return policy;
  }

  @Put(':policyId')
  @RequirePermission('locations:update')
  @ApiOperation({ summary: 'Update inventory policy' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'policyId', description: 'Inventory policy ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory policy updated successfully',
    type: LocationInventoryPolicy,
  })
  async updateInventoryPolicy(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() updateDto: UpdateLocationInventoryPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<LocationInventoryPolicy> {
    return this.locationInventoryPolicyService.updateInventoryPolicy(
      tenantId,
      locationId,
      policyId,
      updateDto,
      user.id,
    );
  }

  @Delete(':policyId')
  @RequirePermission('locations:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete inventory policy' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiParam({ name: 'policyId', description: 'Inventory policy ID' })
  @ApiResponse({ 
    status: 204, 
    description: 'Inventory policy deleted successfully',
  })
  async deleteInventoryPolicy(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    await this.locationInventoryPolicyService.deleteInventoryPolicy(
      tenantId,
      locationId,
      policyId,
      user.id,
    );
  }

  @Post('recommendations')
  @RequirePermission('locations:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get inventory recommendations based on policies' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory recommendations retrieved successfully',
    type: [InventoryRecommendationDto],
  })
  async getInventoryRecommendations(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() productInventory: Array<{
      productId: string;
      categoryId?: string;
      currentStock: number;
      averageDailyDemand?: number;
    }>,
    @CurrentTenant() tenantId: string,
  ): Promise<InventoryRecommendationDto[]> {
    return this.locationInventoryPolicyService.getInventoryRecommendations(
      tenantId,
      locationId,
      productInventory,
    );
  }

  @Post('execute')
  @RequirePermission('locations:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute inventory policies for automatic actions' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory policies executed successfully',
  })
  async executePolicies(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() productInventory: Array<{
      productId: string;
      categoryId?: string;
      currentStock: number;
      averageDailyDemand?: number;
    }>,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Array<{
    productId: string;
    action: string;
    quantity: number;
    success: boolean;
    message: string;
  }>> {
    return this.locationInventoryPolicyService.executePolicies(
      tenantId,
      locationId,
      productInventory,
      user.id,
    );
  }

  @Put('bulk-update')
  @RequirePermission('locations:update')
  @ApiOperation({ summary: 'Bulk update inventory policies' })
  @ApiParam({ name: 'locationId', description: 'Location ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventory policies bulk updated successfully',
  })
  async bulkUpdatePolicies(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() bulkUpdateDto: BulkInventoryPolicyUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ updated: number; created: number; errors: string[] }> {
    return this.locationInventoryPolicyService.bulkUpdatePolicies(
      tenantId,
      locationId,
      bulkUpdateDto,
      user.id,
    );
  }
}