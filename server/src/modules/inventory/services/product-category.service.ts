import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductCategoryRepository } from '../repositories/product-category.repository';
import { CreateCategoryDto, UpdateCategoryDto, CategoryQueryDto } from '../dto/category.dto';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Domain events
export class CategoryCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly categoryId: string,
    public readonly category: any,
    public readonly userId: string,
  ) {}
}

export class CategoryUpdatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly categoryId: string,
    public readonly category: any,
    public readonly previousData: Partial<any>,
    public readonly userId: string,
  ) {}
}

export class CategoryDeletedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly categoryId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class ProductCategoryService {
  constructor(
    private readonly categoryRepository: ProductCategoryRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, data: CreateCategoryDto, userId: string): Promise<any> {
    // Generate slug if not provided
    if (!data.slug) {
      data.slug = this.generateSlug(data.name);
    }

    // Validate slug uniqueness
    const existingCategory = await this.categoryRepository.findBySlug(tenantId, data.slug);
    if (existingCategory) {
      throw new ConflictException(`Category with slug '${data.slug}' already exists`);
    }

    // Validate parent category exists if provided
    if (data.parentId) {
      const parentCategory = await this.categoryRepository.findById(tenantId, data.parentId);
      if (!parentCategory) {
        throw new BadRequestException('Parent category not found');
      }
    }

    const category = await this.categoryRepository.create(tenantId, data, userId);

    // Emit domain event
    this.eventEmitter.emit('category.created', new CategoryCreatedEvent(
      tenantId,
      category.id,
      category,
      userId,
    ));

    // Invalidate cache
    await this.invalidateCategoryCache(tenantId);

    return category;
  }

  async findById(tenantId: string, id: string): Promise<any> {
    const cacheKey = `category:${tenantId}:${id}`;
    let category = await this.cacheService.get<any>(cacheKey);

    if (!category) {
      category = await this.categoryRepository.findById(tenantId, id);
      if (!category) {
        throw new NotFoundException('Category not found');
      }

      await this.cacheService.set(cacheKey, category, { ttl: 300 }); // 5 minutes
    }

    return category;
  }

  async findBySlug(tenantId: string, slug: string): Promise<any> {
    const cacheKey = `category:${tenantId}:slug:${slug}`;
    let category = await this.cacheService.get<any>(cacheKey);

    if (!category) {
      category = await this.categoryRepository.findBySlug(tenantId, slug);
      if (!category) {
        throw new NotFoundException('Category not found');
      }

      await this.cacheService.set(cacheKey, category, { ttl: 300 }); // 5 minutes
    }

    return category;
  }

  async findMany(tenantId: string, query: CategoryQueryDto): Promise<{
    categories: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `categories:${tenantId}:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      categories: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (!result) {
      result = await this.categoryRepository.findMany(tenantId, query);
      await this.cacheService.set(cacheKey, result, { ttl: 180 }); // 3 minutes
    }

    return result;
  }

  async findTree(tenantId: string): Promise<any[]> {
    const cacheKey = `categories:${tenantId}:tree`;
    let tree = await this.cacheService.get<any[]>(cacheKey);

    if (!tree) {
      tree = await this.categoryRepository.findTree(tenantId);
      await this.cacheService.set(cacheKey, tree, { ttl: 300 }); // 5 minutes
    }

    return tree;
  }

  async findChildren(tenantId: string, parentId: string): Promise<any[]> {
    const cacheKey = `categories:${tenantId}:children:${parentId}`;
    let children = await this.cacheService.get<any[]>(cacheKey);

    if (!children) {
      children = await this.categoryRepository.findChildren(tenantId, parentId);
      await this.cacheService.set(cacheKey, children, { ttl: 300 }); // 5 minutes
    }

    return children;
  }

  async update(tenantId: string, id: string, data: UpdateCategoryDto, userId: string): Promise<any> {
    const existingCategory = await this.findById(tenantId, id);

    // Validate slug uniqueness if changed
    if (data.slug && data.slug !== existingCategory.slug) {
      const categoryWithSlug = await this.categoryRepository.findBySlug(tenantId, data.slug);
      if (categoryWithSlug && categoryWithSlug.id !== id) {
        throw new ConflictException(`Category with slug '${data.slug}' already exists`);
      }
    }

    // Validate parent category if changed
    if (data.parentId && data.parentId !== existingCategory.parentId) {
      if (data.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      const parentCategory = await this.categoryRepository.findById(tenantId, data.parentId);
      if (!parentCategory) {
        throw new BadRequestException('Parent category not found');
      }

      // Check for circular reference
      const isCircular = await this.checkCircularReference(tenantId, id, data.parentId);
      if (isCircular) {
        throw new BadRequestException('Circular reference detected in category hierarchy');
      }
    }

    const updatedCategory = await this.categoryRepository.update(tenantId, id, data, userId);

    // Emit domain event
    this.eventEmitter.emit('category.updated', new CategoryUpdatedEvent(
      tenantId,
      id,
      updatedCategory,
      existingCategory,
      userId,
    ));

    // Invalidate cache
    await this.invalidateCategoryCache(tenantId);

    return updatedCategory;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const category = await this.findById(tenantId, id);

    // Check if category has products
    const hasProducts = await this.categoryRepository.hasProducts(tenantId, id);
    if (hasProducts) {
      throw new BadRequestException('Cannot delete category that contains products');
    }

    // Check if category has children
    const children = await this.findChildren(tenantId, id);
    if (children.length > 0) {
      throw new BadRequestException('Cannot delete category that has child categories');
    }

    await this.categoryRepository.delete(tenantId, id, userId);

    // Emit domain event
    this.eventEmitter.emit('category.deleted', new CategoryDeletedEvent(
      tenantId,
      id,
      userId,
    ));

    // Invalidate cache
    await this.invalidateCategoryCache(tenantId);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async checkCircularReference(tenantId: string, categoryId: string, parentId: string): Promise<boolean> {
    let currentParentId: string | null = parentId;
    const visited = new Set<string>();

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        return true; // Circular reference detected
      }

      if (currentParentId === categoryId) {
        return true; // Direct circular reference
      }

      visited.add(currentParentId);

      const parent = await this.categoryRepository.findById(tenantId, currentParentId);
      if (!parent) {
        break;
      }

      currentParentId = parent.parentId || null;
    }

    return false;
  }

  private async invalidateCategoryCache(tenantId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`categories:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`category:${tenantId}:*`);
  }
}