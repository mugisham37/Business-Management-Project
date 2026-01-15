import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductBrandRepository } from '../repositories/product-brand.repository';
import { CreateBrandDto, UpdateBrandDto, BrandQueryDto } from '../dto/brand.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Domain events
export class BrandCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly brandId: string,
    public readonly brand: any,
    public readonly userId: string,
  ) {}
}

export class BrandUpdatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly brandId: string,
    public readonly brand: any,
    public readonly previousData: Partial<any>,
    public readonly userId: string,
  ) {}
}

export class BrandDeletedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly brandId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class ProductBrandService {
  constructor(
    private readonly brandRepository: ProductBrandRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, data: CreateBrandDto, userId: string): Promise<any> {
    // Generate slug if not provided
    if (!data.slug) {
      data.slug = this.generateSlug(data.name);
    }

    // Validate slug uniqueness
    const existingBrand = await this.brandRepository.findBySlug(tenantId, data.slug);
    if (existingBrand) {
      throw new ConflictException(`Brand with slug '${data.slug}' already exists`);
    }

    const brand = await this.brandRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit('brand.created', new BrandCreatedEvent(
      tenantId,
      brand.id,
      brand,
      userId,
    ));

    // Invalidate cache
    await this.invalidateBrandCache(tenantId);

    return brand;
  }

  async findById(tenantId: string, id: string): Promise<any> {
    const cacheKey = `brand:${tenantId}:${id}`;
    let brand = await this.cacheService.get<any>(cacheKey);

    if (!brand) {
      brand = await this.brandRepository.findById(tenantId, id);
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }

      await this.cacheService.set(cacheKey, brand, { ttl: 300 }); // 5 minutes
    }

    return brand;
  }

  async findBySlug(tenantId: string, slug: string): Promise<any> {
    const cacheKey = `brand:${tenantId}:slug:${slug}`;
    let brand = await this.cacheService.get<any>(cacheKey);

    if (!brand) {
      brand = await this.brandRepository.findBySlug(tenantId, slug);
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }

      await this.cacheService.set(cacheKey, brand, { ttl: 300 }); // 5 minutes
    }

    return brand;
  }

  async findMany(tenantId: string, query: BrandQueryDto): Promise<{
    brands: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `brands:${tenantId}:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      brands: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (!result) {
      result = await this.brandRepository.findMany(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180 }); // 3 minutes
    }

    return result;
  }

  async update(tenantId: string, id: string, data: UpdateBrandDto, userId: string): Promise<any> {
    const existingBrand = await this.findById(tenantId, id);

    // Validate slug uniqueness if changed
    if (data.slug && data.slug !== existingBrand.slug) {
      const brandWithSlug = await this.brandRepository.findBySlug(tenantId, data.slug);
      if (brandWithSlug && brandWithSlug.id !== id) {
        throw new ConflictException(`Brand with slug '${data.slug}' already exists`);
      }
    }

    const updatedBrand = await this.brandRepository.update(tenantId, id, data, userId);

    // Emit domain event
    this.eventEmitter.emit('brand.updated', new BrandUpdatedEvent(
      tenantId,
      id,
      updatedBrand,
      existingBrand,
      userId,
    ));

    // Invalidate cache
    await this.invalidateBrandCache(tenantId);

    return updatedBrand;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const brand = await this.findById(tenantId, id);

    // Check if brand has products
    const hasProducts = await this.brandRepository.hasProducts(tenantId, id);
    if (hasProducts) {
      throw new BadRequestException('Cannot delete brand that has products');
    }

    await this.brandRepository.delete(tenantId, id, userId);

    // Emit domain event
    this.eventEmitter.emit('brand.deleted', new BrandDeletedEvent(
      tenantId,
      id,
      userId,
    ));

    // Invalidate cache
    await this.invalidateBrandCache(tenantId);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async invalidateBrandCache(tenantId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`brands:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`brand:${tenantId}:*`);
  }
}