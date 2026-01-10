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
  Request,
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
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { CustomerPortalService } from '../services/customer-portal.service';
import { 
  CustomerPortalLoginDto, 
  CustomerPortalRegistrationDto, 
  CreatePortalOrderDto, 
  PortalOrderQueryDto,
  ProductCatalogQueryDto,
  UpdateAccountInfoDto,
  ChangePasswordDto,
  InvoiceQueryDto
} from '../dto/customer-portal.dto';

@ApiTags('B2B Customer Portal')
@Controller('customer-portal')
@UseGuards(TenantGuard)
@RequireFeature('b2b-operations')
export class CustomerPortalController {
  private readonly logger = new Logger(CustomerPortalController.name);

  constructor(
    private readonly customerPortalService: CustomerPortalService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Customer portal login' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  async login(
    @CurrentTenant() tenantId: string,
    @Body(ValidationPipe) loginDto: CustomerPortalLoginDto,
  ) {
    try {
      const result = await this.customerPortalService.login(tenantId, loginDto);

      this.logger.log(`Customer portal login successful for ${loginDto.email}`);
      
      return {
        success: true,
        data: result,
        message: 'Login successful',
      };
    } catch (error) {
      this.logger.error(`Failed to login customer for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Customer portal registration' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Registration successful',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Registration failed',
  })
  async register(
    @CurrentTenant() tenantId: string,
    @Body(ValidationPipe) registrationDto: CustomerPortalRegistrationDto,
  ) {
    try {
      const result = await this.customerPortalService.register(tenantId, registrationDto);

      this.logger.log(`Customer portal registration successful for ${registrationDto.email}`);
      
      return {
        success: true,
        data: result,
        message: 'Registration successful',
      };
    } catch (error) {
      this.logger.error(`Failed to register customer for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // Protected routes below require authentication
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get customer profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile retrieved successfully',
  })
  async getProfile(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
  ) {
    try {
      const customerId = req.user.sub;
      const profile = await this.customerPortalService.getCustomerProfile(tenantId, customerId);

      return {
        success: true,
        data: profile,
      };
    } catch (error) {
      this.logger.error(`Failed to get customer profile:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('profile')
  @ApiOperation({ summary: 'Update customer account information' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account updated successfully',
  })
  async updateAccountInfo(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
    @Body(ValidationPipe) updateDto: UpdateAccountInfoDto,
  ) {
    try {
      const customerId = req.user.sub;
      const profile = await this.customerPortalService.updateAccountInfo(
        tenantId,
        customerId,
        updateDto,
      );

      this.logger.log(`Updated account info for customer ${customerId}`);

      return {
        success: true,
        data: profile,
        message: 'Account updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update account info:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Change customer password' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
  })
  async changePassword(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto,
  ) {
    try {
      const customerId = req.user.sub;
      await this.customerPortalService.changePassword(
        tenantId,
        customerId,
        changePasswordDto,
      );

      this.logger.log(`Password changed for customer ${customerId}`);

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to change password:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('catalog')
  @ApiOperation({ summary: 'Get product catalog with customer-specific pricing' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product catalog retrieved successfully',
  })
  async getProductCatalog(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
    @Query(ValidationPipe) query: ProductCatalogQueryDto,
  ) {
    try {
      const customerId = req.user.sub;
      const result = await this.customerPortalService.getProductCatalog(
        tenantId,
        customerId,
        query,
      );

      return {
        success: true,
        data: result.products,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (query.limit || 20)),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get product catalog:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('orders')
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order created successfully',
  })
  async createOrder(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
    @Body(ValidationPipe) orderDto: CreatePortalOrderDto,
  ) {
    try {
      const customerId = req.user.sub;
      const order = await this.customerPortalService.createOrder(
        tenantId,
        customerId,
        orderDto,
      );

      this.logger.log(`Created order ${order.orderNumber} for customer ${customerId}`);

      return {
        success: true,
        data: order,
        message: 'Order created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create order:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('orders')
  @ApiOperation({ summary: 'Get customer orders' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Orders retrieved successfully',
  })
  async getOrders(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
    @Query(ValidationPipe) query: PortalOrderQueryDto,
  ) {
    try {
      const customerId = req.user.sub;
      const result = await this.customerPortalService.getOrders(
        tenantId,
        customerId,
        query,
      );

      return {
        success: true,
        data: result.orders,
        pagination: {
          page: query.page || 1,
          limit: query.limit || 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (query.limit || 20)),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get orders:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order retrieved successfully',
  })
  async getOrder(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
    @Param('id', ParseUUIDPipe) orderId: string,
  ) {
    try {
      const customerId = req.user.sub;
      const order = await this.customerPortalService.getOrderById(
        tenantId,
        customerId,
        orderId,
      );

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(`Failed to get order ${orderId}:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('invoices')
  @ApiOperation({ summary: 'Get customer invoices' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoices retrieved successfully',
  })
  async getInvoices(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
    @Query(ValidationPipe) query: InvoiceQueryDto,
  ) {
    try {
      const customerId = req.user.sub;
      
      // This would be implemented with actual invoice service
      // For now, return a placeholder response
      return {
        success: true,
        data: [],
        pagination: {
          page: query.page || 1,
          limit: query.limit || 20,
          total: 0,
          totalPages: 0,
        },
        message: 'Invoice management feature coming soon',
      };
    } catch (error) {
      this.logger.error(`Failed to get invoices:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('invoices/:id/download')
  @ApiOperation({ summary: 'Download invoice PDF' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice PDF download',
  })
  async downloadInvoice(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
    @Param('id', ParseUUIDPipe) invoiceId: string,
  ) {
    try {
      const customerId = req.user.sub;
      
      // This would be implemented with actual invoice PDF generation
      // For now, return a placeholder response
      return {
        success: false,
        message: 'Invoice PDF download feature coming soon',
      };
    } catch (error) {
      this.logger.error(`Failed to download invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('dashboard')
  @ApiOperation({ summary: 'Get customer dashboard data' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard data retrieved successfully',
  })
  async getDashboard(
    @CurrentTenant() tenantId: string,
    @Request() req: any,
  ) {
    try {
      const customerId = req.user.sub;
      
      // This would aggregate data from various services
      // For now, return a placeholder response
      return {
        success: true,
        data: {
          recentOrders: [],
          orderSummary: {
            totalOrders: 0,
            pendingOrders: 0,
            shippedOrders: 0,
            totalSpent: 0,
          },
          accountSummary: {
            creditLimit: 0,
            availableCredit: 0,
            outstandingBalance: 0,
          },
          quickActions: [
            { name: 'Place New Order', url: '/orders/new' },
            { name: 'View Catalog', url: '/catalog' },
            { name: 'Order History', url: '/orders' },
            { name: 'Account Settings', url: '/profile' },
          ],
        },
        message: 'Dashboard data loaded successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard data:`, error);
      throw error;
    }
  }
}