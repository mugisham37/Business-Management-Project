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
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { B2BCustomerService } from '../services/b2b-customer.service';
import { CreateB2BCustomerDto, UpdateB2BCustomerDto, B2BCustomerQueryDto } from '../dto/b2b-customer.dto';

@ApiTags('B2B Customers')
@ApiBearerAuth()
@Controller('b2b-customers')
@UseGuards(JwtAuthGuard, TenantGuard)
export class B2BCustomerController {
  private readonly logger = new Logger(B2BCustomerController.name);

  constructor(private readonly b2bCustomerService: B2BCustomerService) {}

  @Post()
  @RequirePermission('customer:create')
  @ApiOperation({ summary: 'Create a new B2B customer' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'B2B customer created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Company name already exists',
  })
  async createB2BCustomer(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) createDto: CreateB2BCustomerDto,
  ) {
    try {
      const customer = await this.b2bCustomerService.createB2BCustomer(
        tenantId,
        createDto,
        userId,
      );

      this.logger.log(`Created B2B customer ${customer.id} for tenant ${tenantId}`);
      
      return {
        success: true,
        data: customer,
        message: 'B2B customer created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create B2B customer for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Get(':id')
  @RequirePermission('customer:read')
  @ApiOperation({ summary: 'Get B2B customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B customer retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'B2B customer not found',
  })
  async getB2BCustomer(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) customerId: string,
  ) {
    try {
      const customer = await this.b2bCustomerService.findB2BCustomerById(
        tenantId,
        customerId,
      );

      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      this.logger.error(`Failed to get B2B customer ${customerId}:`, error);
      throw error;
    }
  }

  @Get()
  @RequirePermission('customer:read')
  @ApiOperation({ summary: 'Get B2B customers with filtering and pagination' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term' })
  @ApiQuery({ name: 'creditStatus', required: false, description: 'Credit status filter' })
  @ApiQuery({ name: 'pricingTier', required: false, description: 'Pricing tier filter' })
  @ApiQuery({ name: 'paymentTerms', required: false, description: 'Payment terms filter' })
  @ApiQuery({ name: 'salesRepId', required: false, description: 'Sales rep ID filter' })
  @ApiQuery({ name: 'accountManagerId', required: false, description: 'Account manager ID filter' })
  @ApiQuery({ name: 'industry', required: false, description: 'Industry filter' })
  @ApiQuery({ name: 'minCreditLimit', required: false, description: 'Minimum credit limit' })
  @ApiQuery({ name: 'maxCreditLimit', required: false, description: 'Maximum credit limit' })
  @ApiQuery({ name: 'minAnnualRevenue', required: false, description: 'Minimum annual revenue' })
  @ApiQuery({ name: 'maxAnnualRevenue', required: false, description: 'Maximum annual revenue' })
  @ApiQuery({ name: 'contractExpiringWithinDays', required: false, description: 'Contract expiring within days' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc/desc)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B customers retrieved successfully',
  })
  async getB2BCustomers(
    @CurrentTenant() tenantId: string,
    @Query(ValidationPipe) query: B2BCustomerQueryDto,
  ) {
    try {
      const result = await this.b2bCustomerService.findB2BCustomers(tenantId, query);

      return {
        success: true,
        data: result.customers,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (query.limit || 20)),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get B2B customers for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Put(':id')
  @RequirePermission('customer:update')
  @ApiOperation({ summary: 'Update B2B customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B customer updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'B2B customer not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async updateB2BCustomer(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) customerId: string,
    @Body(ValidationPipe) updateDto: UpdateB2BCustomerDto,
  ) {
    try {
      const customer = await this.b2bCustomerService.updateB2BCustomer(
        tenantId,
        customerId,
        updateDto,
        userId,
      );

      this.logger.log(`Updated B2B customer ${customerId} for tenant ${tenantId}`);

      return {
        success: true,
        data: customer,
        message: 'B2B customer updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update B2B customer ${customerId}:`, error);
      throw error;
    }
  }

  @Get(':id/pricing')
  @RequirePermission('customer:read')
  @ApiOperation({ summary: 'Get customer-specific pricing rules' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiQuery({ name: 'productId', required: false, description: 'Product ID filter' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Category ID filter' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer pricing rules retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async getCustomerPricing(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) customerId: string,
    @Query('productId') productId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    try {
      const pricingRules = await this.b2bCustomerService.getCustomerPricing(
        tenantId,
        customerId,
        productId,
        categoryId,
      );

      return {
        success: true,
        data: pricingRules,
      };
    } catch (error) {
      this.logger.error(`Failed to get customer pricing for ${customerId}:`, error);
      throw error;
    }
  }

  @Get(':id/credit-history')
  @RequirePermission('customer:read')
  @ApiOperation({ summary: 'Get customer credit history' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer credit history retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async getCustomerCreditHistory(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) customerId: string,
  ) {
    try {
      // This would be implemented in the service
      // For now, return a placeholder response
      return {
        success: true,
        data: [],
        message: 'Credit history feature coming soon',
      };
    } catch (error) {
      this.logger.error(`Failed to get credit history for customer ${customerId}:`, error);
      throw error;
    }
  }

  @Post(':id/credit-review')
  @RequirePermission('customer:manage_credit')
  @ApiOperation({ summary: 'Initiate credit review for B2B customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Credit review initiated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async initiateCreditReview(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) customerId: string,
  ) {
    try {
      // This would be implemented in the service
      // For now, return a placeholder response
      this.logger.log(`Credit review initiated for customer ${customerId} by user ${userId}`);

      return {
        success: true,
        message: 'Credit review initiated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate credit review for customer ${customerId}:`, error);
      throw error;
    }
  }

  @Get('analytics/summary')
  @RequirePermission('customer:read')
  @ApiOperation({ summary: 'Get B2B customer analytics summary' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'B2B customer analytics retrieved successfully',
  })
  async getB2BAnalyticsSummary(@CurrentTenant() tenantId: string) {
    try {
      // This would be implemented in the service
      // For now, return a placeholder response
      return {
        success: true,
        data: {
          totalB2BCustomers: 0,
          totalCreditLimit: 0,
          averageCreditLimit: 0,
          creditStatusDistribution: {},
          pricingTierDistribution: {},
          industryDistribution: {},
        },
        message: 'B2B analytics feature coming soon',
      };
    } catch (error) {
      this.logger.error(`Failed to get B2B analytics for tenant ${tenantId}:`, error);
      throw error;
    }
  }
}