import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProductService } from '../services/product.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from '../dto/product.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { RequirePermission } from '../../auth/decorators/auth.decorators';

@Resolver('Product')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('inventory-management')
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query()
  @RequirePermission('products:read')
  async products(
    @Args('query') query: ProductQueryDto,
    @Context() context: any,
  ) {
    const tenantId = context.req.user.tenantId;
    return this.productService.findMany(tenantId, query);
  }

  @Query()
  @RequirePermission('products:read')
  async product(
    @Args('id') id: string,
    @Context() context: any,
  ) {
    const tenantId = context.req.user.tenantId;
    return this.productService.findById(tenantId, id);
  }

  @Mutation()
  @RequirePermission('products:create')
  async createProduct(
    @Args('input') input: CreateProductDto,
    @Context() context: any,
  ) {
    const tenantId = context.req.user.tenantId;
    const userId = context.req.user.id;
    return this.productService.create(tenantId, input, userId);
  }

  @Mutation()
  @RequirePermission('products:update')
  async updateProduct(
    @Args('id') id: string,
    @Args('input') input: UpdateProductDto,
    @Context() context: any,
  ) {
    const tenantId = context.req.user.tenantId;
    const userId = context.req.user.id;
    return this.productService.update(tenantId, id, input, userId);
  }

  @Mutation()
  @RequirePermission('products:delete')
  async deleteProduct(
    @Args('id') id: string,
    @Context() context: any,
  ) {
    const tenantId = context.req.user.tenantId;
    const userId = context.req.user.id;
    await this.productService.delete(tenantId, id, userId);
    return true;
  }
}