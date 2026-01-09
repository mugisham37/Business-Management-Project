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
} from '@nestjs/swagger';
import { CustomerService } from '../services/customer.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from '../dto/customer.dto';
import { Customer } from '../entities/customer.entity';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/customers')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('customer-management')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Customers')
@ApiBearerAuth()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @RequirePermission('customers:create')
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Customer created successfully',
    type: Customer 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid customer data' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Customer with email or phone already exists' 
  })
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer> {
    return this.customerService.create(tenantId, createCustomerDto, user.id);
  }

  @Get()
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customers with filtering and pagination' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Customers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        customers: {
          type: 'array',
          items: { $ref: '#/components/schemas/Customer' }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  async findMany(
    @Query() query: CustomerQueryDto,
    @CurrentTenant() tenantId: string,
  ): Promise<{
    customers: Customer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await this.customerService.findMany(tenantId, query);
    
    return {
      ...result,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }

  @Get('stats')
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customer statistics' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Customer statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalCustomers: { type: 'number' },
        activeCustomers: { type: 'number' },
        newCustomersThisMonth: { type: 'number' },
        averageLifetimeValue: { type: 'number' },
        topLoyaltyTier: {
          type: 'object',
          properties: {
            tier: { type: 'string' },
            count: { type: 'number' }
          }
        }
      }
    }
  })
  async getStats(@CurrentTenant() tenantId: string) {
    return this.customerService.getCustomerStats(tenantId);
  }

  @Get('search/email/:email')
  @RequirePermission('customers:read')
  @ApiOperation({ summary: 'Find customer by email' })
  @ApiParam({ name: 'email', description: 'Customer email address' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Customer found',
    type: Customer 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Customer not found' 
  })
  async findByEmail(
    @Param('email') email: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer | null> {
    return this.customerService.findByEmail(tenantId, email);
  }

  @Get('search/phone/:phone')
  @RequirePermission('customers:read')
  @ApiOperation({ summary: 'Find customer by phone number' })
  @ApiParam({ name: 'phone', description: 'Customer phone number' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Customer found',
    type: Customer 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Customer not found' 
  })
  async findByPhone(
    @Param('phone') phone: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer | null> {
    return this.customerService.findByPhone(tenantId, phone);
  }

  @Get(':id')
  @RequirePermission('customers:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Customer retrieved successfully',
    type: Customer 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Customer not found' 
  })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer> {
    return this.customerService.findById(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('customers:update')
  @ApiOperation({ summary: 'Update customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Customer updated successfully',
    type: Customer 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Customer not found' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid customer data' 
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Customer with email or phone already exists' 
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<Customer> {
    return this.customerService.update(tenantId, id, updateCustomerDto, user.id);
  }

  @Delete(':id')
  @RequirePermission('customers:delete')
  @ApiOperation({ summary: 'Delete customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: 'Customer deleted successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Customer not found' 
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    return this.customerService.delete(tenantId, id, user.id);
  }

  @Post(':id/purchase-stats')
  @RequirePermission('customers:update')
  @ApiOperation({ summary: 'Update customer purchase statistics' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Purchase statistics updated successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Customer not found' 
  })
  async updatePurchaseStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { orderValue: number; orderDate?: string },
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    const orderDate = data.orderDate ? new Date(data.orderDate) : new Date();
    return this.customerService.updatePurchaseStats(tenantId, id, data.orderValue, orderDate);
  }

  @Post(':id/loyalty-points')
  @RequirePermission('customers:update')
  @RequireFeature('loyalty-program')
  @ApiOperation({ summary: 'Update customer loyalty points' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Loyalty points updated successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Customer not found' 
  })
  async updateLoyaltyPoints(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { pointsChange: number; reason: string },
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    return this.customerService.updateLoyaltyPoints(tenantId, id, data.pointsChange, data.reason);
  }
}