import { Resolver, Query, Mutation, Args, ID, Int, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { JwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { Permissions } from '../../auth/decorators/require-permission.decorator';
import { ProductCategoryService } from '../services/product-category.service';
import { ProductService } from '../services/product.service';
import { Category } from '../types/category.types';
import { CreateCategoryInput, UpdateCategoryInput, CategoryFilterInput } from '../inputs/category.input';
import { OffsetPaginationArgs } from '../../../common/graphql/pagination.args';

@Resolver(() => Category)
@UseGuards(JwtAuthGuard)
export class CategoryResolver extends BaseResolver {
  constructor(
    override readonly dataLoaderService: DataLoaderService,
    private readonly categoryService: ProductCategoryService,
    private readonly productService: ProductService,
  ) {
    super(dataLoaderService);
  }

  @Query(() => Category, { description: 'Get category by ID' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async category(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Category> {
    return this.categoryService.findById(tenantId || '', id);
  }

  @Query(() => Category, { description: 'Get category by slug' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async categoryBySlug(
    @Args('slug') slug: string,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Category> {
    return this.categoryService.findBySlug(tenantId || '', slug);
  }

  @Query(() => [Category], { description: 'Get categories with optional filtering' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async categories(
    @Args('filter', { type: () => CategoryFilterInput, nullable: true }) filter?: CategoryFilterInput,
    @Args('pagination', { type: () => OffsetPaginationArgs, nullable: true }) pagination?: OffsetPaginationArgs,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Category[]> {
    const query = {
      ...filter,
      offset: pagination?.offset || 0,
      limit: pagination?.limit || 20,
    };

    const result = await this.categoryService.findMany(tenantId || '', query);
    return result.categories;
  }

  @Query(() => [Category], { description: 'Get complete category tree' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:read')
  async categoryTree(
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Category[]> {
    return this.categoryService.findTree(tenantId || '');
  }

  @Mutation(() => Category, { description: 'Create new category' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:create')
  async createCategory(
    @Args('input') input: CreateCategoryInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Category> {
    return this.categoryService.create(tenantId || '', input, user?.id);
  }

  @Mutation(() => Category, { description: 'Update category' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:update')
  async updateCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCategoryInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Category> {
    return this.categoryService.update(tenantId || '', id, input, user?.id);
  }

  @Mutation(() => Category, { description: 'Move category to new parent' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:update')
  async moveCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('newParentId', { type: () => ID, nullable: true }) newParentId?: string | null,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Category> {
    // Build update input conditionally to satisfy exactOptionalPropertyTypes
    const updateInput: { parentId?: string } = {};
    if (newParentId) {
      updateInput.parentId = newParentId;
    }
    return this.categoryService.update(tenantId || '', id, updateInput, user?.id);
  }

  @Mutation(() => Boolean, { description: 'Delete category' })
  @UseGuards(PermissionsGuard)
  @Permissions('inventory:delete')
  async deleteCategory(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<boolean> {
    await this.categoryService.delete(tenantId || '', id, user?.id || '');
    return true;
  }

  @ResolveField(() => Category, { nullable: true, description: 'Parent category' })
  async parent(
    @Parent() category: Category,
    @CurrentTenant() tenantId: string,
  ): Promise<Category | null> {
    if (!category.parentId) {
      return null;
    }

    const loader = this.getDataLoader(
      'category_by_id',
      async (ids: readonly string[]) => {
        const categories = await Promise.all(
          ids.map(id => this.categoryService.findById(tenantId, id).catch(() => null))
        );
        return categories;
      },
    );
    return loader.load(category.parentId);
  }

  @ResolveField(() => [Category], { description: 'Child categories' })
  async children(
    @Parent() category: Category,
    @CurrentTenant() tenantId: string,
  ): Promise<Category[]> {
    return this.categoryService.findChildren(tenantId, category.id);
  }

  @ResolveField(() => [Object], { description: 'Products in this category' })
  async products(
    @Parent() category: Category,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    // Use DataLoader to batch load products by category ID
    const loader = this.getDataLoader(
      'products_by_category_id',
      async (categoryIds: readonly string[]) => {
        const results = await Promise.all(
          categoryIds.map(categoryId =>
            this.productService.findMany(tenantId, { categoryId, limit: 100 })
          )
        );
        return results.map(result => result.products);
      },
    );
    return loader.load(category.id);
  }
}
