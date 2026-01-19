import { Resolver, Query, Mutation, Args, Context, ResolveField, Parent, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProductService } from '../services/product.service';
import { Product } from '../types/product.types';
import { CreateProductInput, UpdateProductInput, ProductFilterInput, BulkUpdateProductsInput } from '../inputs/product.input';
import { OffsetPaginationArgs } from '../../../common/graphql/pagination.args';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

@Resolver(() => Product)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-management')
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(() => [Product])
  @RequirePermission('products:read')
  async products(
    @Args('filter', { type: () => ProductFilterInput, nullable: true }) filter?: ProductFilterInput,
    @Args('pagination', { type: () => OffsetPaginationArgs, nullable: true }) pagination?: OffsetPaginationArgs,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Product[]> {
    const query = {
      ...filter,
      offset: pagination?.offset || 0,
      limit: pagination?.limit || 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };
    
    const result = await this.productService.findMany(tenantId || '', query);
    return (result.products || []) as any as Product[];
  }

  @Query(() => Product, { nullable: true })
  @RequirePermission('products:read')
  async product(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Product | null> {
    const result = await this.productService.findById(tenantId || '', id);
    return result as unknown as Product | null;
  }

  @Mutation(() => Product)
  @RequirePermission('products:create')
  async createProduct(
    @Args('input') input: CreateProductInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Product> {
    const result = await this.productService.create(tenantId || '', input, user?.id || '');
    return result as unknown as Product;
  }

  @Mutation(() => Product)
  @RequirePermission('products:update')
  async updateProduct(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateProductInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Product> {
    const result = await this.productService.update(tenantId || '', id, input, user?.id || '');
    return result as unknown as Product;
  }

  @Mutation(() => Boolean)
  @RequirePermission('products:delete')
  async deleteProduct(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<boolean> {
    await this.productService.delete(tenantId || '', id, user?.id || '');
    return true;
  }

  @Mutation(() => [Product])
  @RequirePermission('products:update')
  async bulkUpdateProducts(
    @Args('input') input: BulkUpdateProductsInput,
    @CurrentUser() user?: any,
    @CurrentTenant() tenantId?: string,
  ): Promise<Product[]> {
    const result = await this.productService.bulkUpdate(tenantId || '', input.productIds, input.updates, user?.id || '');
    return result as unknown as Product[];
  }

  @ResolveField(() => Object, { nullable: true })
  async category(
    @Parent() product: Product,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    if (!product.categoryId) return null;
    // This would use a category service or dataloader
    return { id: product.categoryId, name: 'Category' }; // Placeholder
  }

  @ResolveField(() => Object, { nullable: true })
  async brand(
    @Parent() product: Product,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    if (!product.brandId) return null;
    // This would use a brand service or dataloader
    return { id: product.brandId, name: 'Brand' }; // Placeholder
  }

  @ResolveField(() => Object, { nullable: true })
  async supplier(
    @Parent() product: Product,
    @CurrentTenant() tenantId?: string,
  ): Promise<any> {
    if (!product.supplierId) return null;
    // This would use a supplier service or dataloader
    return { id: product.supplierId, name: 'Supplier' }; // Placeholder
  }
}