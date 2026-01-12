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
} from '@nestjs/swagger';
import { ProductService } from '../services/product.service';
import { 
  CreateProductDto, 
  UpdateProductDto, 
  ProductQueryDto, 
  BulkUpdateProductsDto,
  ProductResponseDto 
} from '../dto/product.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/products')
@UseGuards(AuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-management')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Products')
@ApiBearerAuth()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @RequirePermission('products:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ 
    status: 201, 
    description: 'Product created successfully',
    type: ProductResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Product with SKU already exists' })
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<ProductResponseDto> {
    return this.productService.create(tenantId, createProductDto, user.id);
  }

  @Get()
  @RequirePermission('products:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get products with filtering and pagination' })
  @ApiResponse({ 
    status: 200, 
    description: 'Products retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        products: { type: 'array', items: { $ref: '#/components/schemas/ProductResponseDto' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  async getProducts(
    @Query() query: ProductQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.productService.findMany(tenantId, query);
  }

  @Get('search')
  @RequirePermission('products:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Search products by term' })
  @ApiQuery({ name: 'q', description: 'Search term' })
  @ApiQuery({ name: 'limit', description: 'Maximum results', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Search results',
    type: [ProductResponseDto] 
  })
  async searchProducts(
    @Query('q') searchTerm: string,
    @Query('limit') limit: number = 10,
    @CurrentTenant() tenantId: string,
  ): Promise<ProductResponseDto[]> {
    return this.productService.searchProducts(tenantId, searchTerm, limit);
  }

  @Get('low-stock')
  @RequirePermission('products:read')
  @RequireFeature('advanced-inventory')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get products with low stock levels' })
  @ApiQuery({ name: 'locationId', description: 'Filter by location', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Low stock products',
    type: [ProductResponseDto] 
  })
  async getLowStockProducts(
    @Query('locationId') locationId?: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ProductResponseDto[]> {
    return this.productService.findLowStockProducts(tenantId, locationId);
  }

  @Get(':id')
  @RequirePermission('products:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Product found',
    type: ProductResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ProductResponseDto> {
    return this.productService.findById(tenantId, id);
  }

  @Get('sku/:sku')
  @RequirePermission('products:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get product by SKU' })
  @ApiParam({ name: 'sku', description: 'Product SKU' })
  @ApiResponse({ 
    status: 200, 
    description: 'Product found',
    type: ProductResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductBySku(
    @Param('sku') sku: string,
    @CurrentTenant() tenantId: string,
  ): Promise<ProductResponseDto> {
    return this.productService.findBySku(tenantId, sku);
  }

  @Put(':id')
  @RequirePermission('products:update')
  @ApiOperation({ summary: 'Update product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Product updated successfully',
    type: ProductResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<ProductResponseDto> {
    return this.productService.update(tenantId, id, updateProductDto, user.id);
  }

  @Put('bulk')
  @RequirePermission('products:update')
  @RequireFeature('advanced-inventory')
  @ApiOperation({ summary: 'Bulk update products' })
  @ApiResponse({ 
    status: 200, 
    description: 'Products updated successfully',
    schema: {
      type: 'object',
      properties: {
        updatedCount: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async bulkUpdateProducts(
    @Body() bulkUpdateDto: BulkUpdateProductsDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<{ updatedCount: number }> {
    const updatedCount = await this.productService.bulkUpdate(
      tenantId,
      bulkUpdateDto.productIds,
      bulkUpdateDto.updates,
      user.id,
    );
    return { updatedCount };
  }

  @Delete(':id')
  @RequirePermission('products:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product (soft delete)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 204, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async deleteProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    await this.productService.delete(tenantId, id, user.id);
  }
}