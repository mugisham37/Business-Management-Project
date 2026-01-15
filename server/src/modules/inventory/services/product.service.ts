import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductRepository, ProductWithVariants } from '../repositories/product.repository';
import { CreateProductDto, UpdateProductDto, ProductQueryDto, BulkUpdateProductsDto } from '../dto/product.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Domain events
export class ProductCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly product: ProductWithVariants,
    public readonly userId: string,
  ) {}
}

export class ProductUpdatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly product: ProductWithVariants,
    public readonly previousData: Partial<ProductWithVariants>,
    public readonly userId: string,
  ) {}
}

export class ProductDeletedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly productId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, data: CreateProductDto, userId: string): Promise<ProductWithVariants> {
    // Validate SKU uniqueness
    const existingProduct = await this.productRepository.findBySku(tenantId, data.sku);
    if (existingProduct) {
      throw new ConflictException(`Product with SKU '${data.sku}' already exists`);
    }

    // Validate variants for variable products
    if (data.type === 'variable') {
      if (!data.variants || data.variants.length === 0) {
        throw new BadRequestException('Variable products must have at least one variant');
      }

      // Check for duplicate variant SKUs
      const variantSkus = data.variants.map(v => v.sku);
      const uniqueSkus = new Set(variantSkus);
      if (variantSkus.length !== uniqueSkus.size) {
        throw new BadRequestException('Variant SKUs must be unique');
      }

      // Validate variant attributes
      for (const variant of data.variants) {
        if (!variant.attributes || variant.attributes.length === 0) {
          throw new BadRequestException('Each variant must have at least one attribute');
        }
      }
    }

    const product = await this.productRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit('product.created', new ProductCreatedEvent(
      tenantId,
      product.id,
      product,
      userId,
    ));

    // Invalidate cache
    await this.invalidateProductCache(tenantId);

    return product;
  }

  async findById(tenantId: string, id: string): Promise<ProductWithVariants> {
    const cacheKey = `product:${tenantId}:${id}`;
    let product = await this.cacheService.get<ProductWithVariants>(cacheKey);

    if (!product) {
      product = await this.productRepository.findById(tenantId, id);
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      await this.cacheService.set(cacheKey, product, { ttl: 300 }); // 5 minutes
    }

    return product;
  }

  async findBySku(tenantId: string, sku: string): Promise<ProductWithVariants> {
    const cacheKey = `product:${tenantId}:sku:${sku}`;
    let product = await this.cacheService.get<ProductWithVariants>(cacheKey);

    if (!product) {
      product = await this.productRepository.findBySku(tenantId, sku);
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      await this.cacheService.set(cacheKey, product, { ttl: 300 }); // 5 minutes
    }

    return product;
  }

  async findMany(tenantId: string, query: ProductQueryDto): Promise<{
    products: ProductWithVariants[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `products:${tenantId}:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      products: ProductWithVariants[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (!result) {
      result = await this.productRepository.findMany(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180 }); // 3 minutes
    }

    return result;
  }

  async searchProducts(tenantId: string, searchTerm: string, limit: number = 10): Promise<ProductWithVariants[]> {
    const cacheKey = `products:${tenantId}:search:${searchTerm}:${limit}`;
    let products = await this.cacheService.get<ProductWithVariants[]>(cacheKey);

    if (!products) {
      products = await this.productRepository.searchProducts(tenantId, searchTerm, limit);
      await this.cacheService.set(cacheKey, products, { ttl: 120 }); // 2 minutes
    }

    return products;
  }

  async findLowStockProducts(tenantId: string, locationId?: string): Promise<ProductWithVariants[]> {
    const cacheKey = `products:${tenantId}:low-stock:${locationId || 'all'}`;
    let products = await this.cacheService.get<ProductWithVariants[]>(cacheKey);

    if (!products) {
      products = await this.productRepository.findLowStockProducts(tenantId, locationId);
      await this.cacheService.set(cacheKey, products, { ttl: 60 }); // 1 minute
    }

    return products;
  }

  async update(tenantId: string, id: string, data: UpdateProductDto, userId: string): Promise<ProductWithVariants> {
    const existingProduct = await this.findById(tenantId, id);

    // Validate SKU uniqueness if changed
    if (data.sku && data.sku !== existingProduct.sku) {
      const productWithSku = await this.productRepository.findBySku(tenantId, data.sku);
      if (productWithSku && productWithSku.id !== id) {
        throw new ConflictException(`Product with SKU '${data.sku}' already exists`);
      }
    }

    // Validate variants if provided
    if (data.variants) {
      const variantSkus = data.variants.map(v => v.sku);
      const uniqueSkus = new Set(variantSkus);
      if (variantSkus.length !== uniqueSkus.size) {
        throw new BadRequestException('Variant SKUs must be unique');
      }
    }

    const updatedProduct = await this.productRepository.update(tenantId, id, data, userId);

    if (!updatedProduct) {
      throw new NotFoundException('Product not found or could not be updated');
    }

    // Emit domain event
    this.eventEmitter.emit('product.updated', new ProductUpdatedEvent(
      tenantId,
      id,
      updatedProduct,
      existingProduct,
      userId,
    ));

    // Invalidate cache
    await this.invalidateProductCache(tenantId);

    return updatedProduct;
  }

  async bulkUpdate(tenantId: string, productIds: string[], data: UpdateProductDto, userId: string): Promise<number> {
    const updatedCount = await this.productRepository.bulkUpdate(tenantId, productIds, data, userId);

    // Invalidate cache
    await this.invalidateProductCache(tenantId);

    return updatedCount;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const product = await this.findById(tenantId, id);

    await this.productRepository.delete(tenantId, id, userId);

    // Emit domain event
    this.eventEmitter.emit('product.deleted', new ProductDeletedEvent(
      tenantId,
      id,
      userId,
    ));

    // Invalidate cache
    await this.invalidateProductCache(tenantId);
  }

  private async invalidateProductCache(tenantId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`products:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`product:${tenantId}:*`);
  }
}