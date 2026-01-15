import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { TerritoryService } from '../services/territory.service';
import { 
  CreateTerritoryDto, 
  UpdateTerritoryDto, 
  TerritoryQueryDto,
  AssignCustomerToTerritoryDto,
  BulkAssignCustomersDto,
  TerritoryPerformanceDto
} from '../dto/territory.dto';

@ApiTags('B2B Sales Territories')
@ApiBearerAuth()
@Controller('b2b-territories')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('b2b-operations')
export class TerritoryController {
  private readonly logger = new Logger(TerritoryController.name);

  constructor(
    private readonly territoryService: TerritoryService,
  ) {}

  @Post()
  @RequirePermission('territory:create')
  @ApiOperation({ summary: 'Create a new sales territory' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Territory created successfully',
  })
  async createTerritory(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) createDto: CreateTerritoryDto,
  ) {
    try {
      const territory = await this.territoryService.createTerritory(
        tenantId,
        createDto,
        userId,
      );

      this.logger.log(`Created territory ${territory.territoryCode} for tenant ${tenantId}`);
      
      return {
        success: true,
        data: territory,
        message: 'Territory created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create territory for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Get(':id')
  @RequirePermission('territory:read')
  @ApiOperation({ summary: 'Get territory by ID' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Territory retrieved successfully',
  })
  async getTerritory(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) territoryId: string,
  ) {
    try {
      const territory = await this.territoryService.findTerritoryById(
        tenantId,
        territoryId,
      );

      return {
        success: true,
        data: territory,
      };
    } catch (error) {
      this.logger.error(`Failed to get territory ${territoryId}:`, error);
      throw error;
    }
  }

  @Get()
  @RequirePermission('territory:read')
  @ApiOperation({ summary: 'Get territories with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Territories retrieved successfully',
  })
  async getTerritories(
    @CurrentTenant() tenantId: string,
    @Query(ValidationPipe) query: TerritoryQueryDto,
  ) {
    try {
      const result = await this.territoryService.findTerritories(tenantId, query);

      return {
        success: true,
        data: result.territories,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (query.limit || 20)),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get territories for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Put(':id')
  @RequirePermission('territory:update')
  @ApiOperation({ summary: 'Update territory' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Territory updated successfully',
  })
  async updateTerritory(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) territoryId: string,
    @Body(ValidationPipe) updateDto: UpdateTerritoryDto,
  ) {
    try {
      const territory = await this.territoryService.updateTerritory(
        tenantId,
        territoryId,
        updateDto,
        userId,
      );

      this.logger.log(`Updated territory ${territoryId} for tenant ${tenantId}`);

      return {
        success: true,
        data: territory,
        message: 'Territory updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update territory ${territoryId}:`, error);
      throw error;
    }
  }

  @Post(':id/customers')
  @RequirePermission('territory:assign_customers')
  @ApiOperation({ summary: 'Assign customer to territory' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer assigned to territory successfully',
  })
  async assignCustomerToTerritory(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) territoryId: string,
    @Body(ValidationPipe) assignDto: AssignCustomerToTerritoryDto,
  ) {
    try {
      const assignment = await this.territoryService.assignCustomerToTerritory(
        tenantId,
        territoryId,
        assignDto,
        userId,
      );

      this.logger.log(`Assigned customer ${assignDto.customerId} to territory ${territoryId}`);

      return {
        success: true,
        data: assignment,
        message: 'Customer assigned to territory successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to assign customer to territory ${territoryId}:`, error);
      throw error;
    }
  }

  @Post(':id/customers/bulk')
  @RequirePermission('territory:assign_customers')
  @ApiOperation({ summary: 'Bulk assign customers to territory' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customers assigned to territory successfully',
  })
  async bulkAssignCustomers(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) territoryId: string,
    @Body(ValidationPipe) bulkAssignDto: BulkAssignCustomersDto,
  ) {
    try {
      const assignments = await this.territoryService.bulkAssignCustomers(
        tenantId,
        territoryId,
        bulkAssignDto,
        userId,
      );

      this.logger.log(`Bulk assigned ${bulkAssignDto.customerIds.length} customers to territory ${territoryId}`);

      return {
        success: true,
        data: assignments,
        message: `${assignments.length} customers assigned to territory successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to bulk assign customers to territory ${territoryId}:`, error);
      throw error;
    }
  }

  @Get(':id/customers')
  @RequirePermission('territory:read')
  @ApiOperation({ summary: 'Get customers assigned to territory' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Territory customers retrieved successfully',
  })
  async getTerritoryCustomers(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) territoryId: string,
  ) {
    try {
      const customers = await this.territoryService.getTerritoryCustomers(
        tenantId,
        territoryId,
      );

      return {
        success: true,
        data: customers,
        message: `Found ${customers.length} customers in territory`,
      };
    } catch (error) {
      this.logger.error(`Failed to get territory customers for ${territoryId}:`, error);
      throw error;
    }
  }

  @Get(':id/performance')
  @RequirePermission('territory:read')
  @ApiOperation({ summary: 'Get territory performance metrics' })
  @ApiParam({ name: 'id', description: 'Territory ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Performance period start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Performance period end date' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Territory performance retrieved successfully',
  })
  async getTerritoryPerformance(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) territoryId: string,
    @Query(ValidationPipe) performanceQuery: TerritoryPerformanceDto,
  ) {
    try {
      // Default to current quarter if no dates provided
      const endDate = performanceQuery.endDate ? new Date(performanceQuery.endDate) : new Date();
      const startDate = performanceQuery.startDate ? new Date(performanceQuery.startDate) : (() => {
        const date = new Date(endDate);
        date.setMonth(date.getMonth() - 3);
        return date;
      })();

      const performance = await this.territoryService.getTerritoryPerformance(
        tenantId,
        territoryId,
        startDate,
        endDate,
      );

      return {
        success: true,
        data: performance,
      };
    } catch (error) {
      this.logger.error(`Failed to get territory performance for ${territoryId}:`, error);
      throw error;
    }
  }

  @Get('analytics/summary')
  @RequirePermission('territory:read')
  @ApiOperation({ summary: 'Get territory analytics summary' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Territory analytics retrieved successfully',
  })
  async getTerritoryAnalyticsSummary(@CurrentTenant() tenantId: string) {
    try {
      // This would be implemented with actual analytics
      // For now, return a placeholder response
      return {
        success: true,
        data: {
          totalTerritories: 0,
          activeTerritories: 0,
          totalCustomersAssigned: 0,
          averageRevenuePerTerritory: 0,
          topPerformingTerritories: [],
          territoryTypeDistribution: {},
        },
        message: 'Territory analytics feature coming soon',
      };
    } catch (error) {
      this.logger.error(`Failed to get territory analytics for tenant ${tenantId}:`, error);
      throw error;
    }
  }
}