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
import { ProductCategoryService } from '../services/product-category.service';
import { 
  CreateCategoryDto, 
  UpdateCategoryDto, 
  CategoryQueryDto,
  CategoryResponseDto 
} from '../dto/category.dto';
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

@Controller('api/v1/categories')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-management')
@UseInterceptors(LoggingInterceptor)
@ApiTags('Product Categories')
@ApiBearerAuth()
export class CategoryController {
  constructor(private readonly categoryService: ProductCategoryService) {}

  @Post()
  @RequirePermission('categories:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product category' })
  @ApiResponse({ 
    status: 201, 
    description: 'Category created successfully',
    type: CategoryResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Category with slug already exists' })
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.create(tenantId, createCategoryDto, user.id);
  }

  @Get()
  @RequirePermission('categories:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get categories with filtering and pagination' })
  @ApiResponse({ 
    status: 200, 
    description: 'Categories retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        categories: { type: 'array', items: { $ref: '#/components/schemas/CategoryResponseDto' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  async getCategories(
    @Query() query: CategoryQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.categoryService.findMany(tenantId, query);
  }

  @Get('tree')
  @RequirePermission('categories:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get categories as hierarchical tree' })
  @ApiResponse({ 
    status: 200, 
    description: 'Category tree retrieved successfully',
    type: [CategoryResponseDto] 
  })
  async getCategoryTree(
    @CurrentTenant() tenantId: string,
  ): Promise<CategoryResponseDto[]> {
    return this.categoryService.findTree(tenantId);
  }

  @Get(':id')
  @RequirePermission('categories:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Category found',
    type: CategoryResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.findById(tenantId, id);
  }

  @Get(':id/children')
  @RequirePermission('categories:read')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get category children' })
  @ApiParam({ name: 'id', description: 'Parent category ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Child categories found',
    type: [CategoryResponseDto] 
  })
  async getCategoryChildren(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<CategoryResponseDto[]> {
    return this.categoryService.findChildren(tenantId, id);
  }

  @Put(':id')
  @RequirePermission('categories:update')
  @ApiOperation({ summary: 'Update category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Category updated successfully',
    type: CategoryResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.update(tenantId, id, updateCategoryDto, user.id);
  }

  @Delete(':id')
  @RequirePermission('categories:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete category (soft delete)' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 204, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete category with products' })
  async deleteCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    await this.categoryService.delete(tenantId, id, user.id);
  }
}