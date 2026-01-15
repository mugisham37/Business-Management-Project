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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductBrandService } from '../services/product-brand.service';
import { 
  CreateBrandDto, 
  UpdateBrandDto, 
  BrandQueryDto,
  BrandResponseDto 
} from '../dto/brand.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Controller('api/v1/brands')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-management')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Product Brands')
@ApiBearerAuth()
export class BrandController {
  constructor(private readonly brandService: ProductBrandService) {}

  @Post()
  @RequirePermission('brands:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product brand' })
  @ApiResponse({ 
    status: 201, 
    description: 'Brand created successfully',
    type: BrandResponseDto 
  })
  async createBrand(
    @Body() createBrandDto: CreateBrandDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<BrandResponseDto> {
    return this.brandService.create(tenantId, createBrandDto, user.id);
  }

  @Get()
  @RequirePermission('brands:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get brands with filtering and pagination' })
  @ApiResponse({ 
    status: 200, 
    description: 'Brands retrieved successfully',
  })
  async getBrands(
    @Query() query: BrandQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.brandService.findMany(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('brands:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Brand found',
    type: BrandResponseDto 
  })
  async getBrand(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<BrandResponseDto> {
    return this.brandService.findById(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('brands:update')
  @ApiOperation({ summary: 'Update brand' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Brand updated successfully',
    type: BrandResponseDto 
  })
  async updateBrand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBrandDto: UpdateBrandDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<BrandResponseDto> {
    return this.brandService.update(tenantId, id, updateBrandDto, user.id);
  }

  @Delete(':id')
  @RequirePermission('brands:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete brand (soft delete)' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiResponse({ status: 204, description: 'Brand deleted successfully' })
  async deleteBrand(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    await this.brandService.delete(tenantId, id, user.id);
  }
}