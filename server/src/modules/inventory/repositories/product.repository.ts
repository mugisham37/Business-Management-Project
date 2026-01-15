import { Injectable, Inject } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  products, 
  productVariants, 
  productCategories, 
  productBrands
} from '../../database/schema';
import { eq, and, ilike, inArray, or, desc, asc, sql, count } from 'drizzle-orm';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from '../dto/product.dto';

export interface ProductWithVariants {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description: string | null;
  shortDescription?: string | null;
  type: 'simple' | 'variable' | 'grouped' | 'digital' | 'service';
  status: 'active' | 'inactive' | 'discontinued' | 'out_of_stock';
  categoryId?: string | null;
  brandId?: string | null;
  tags: string[];
  basePrice: string;
  costPrice?: string | null;
  msrp?: string | null;
  trackInventory: boolean;
  unitOfMeasure: string;
  weight?: string | null;
  dimensions?: any;
  taxable: boolean;
  taxCategoryId?: string | null;
  slug?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  images: any[];
  primaryImageUrl?: string | null;
  attributes?: any;
  customFields?: any;
  supplierId?: string | null;
  supplierSku?: string | null;
  minStockLevel: number | null;
  maxStockLevel?: number | null;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  requiresBatchTracking: boolean;
  requiresExpiryDate: boolean;
  shelfLife?: number | null;
  isFeatured: boolean;
  allowBackorders: boolean;
  launchedAt?: string | null;
  discontinuedAt?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  version: number;
  variants: any[];
  category?: any;
  brand?: any;
}

@Injectable()
export class ProductRepository {
  constructor(
    @Inject('DRIZZLE_SERVICE') private readonly drizzle: DrizzleService,
  ) {}

  async create(tenantId: string, data: CreateProductDto, userId: string): Promise<ProductWithVariants> {
    const db = this.drizzle.getDb();
    
    return await db.transaction(async (tx) => {
      // Create the main product
      const [product] = await tx
        .insert(products)
        .values({
          tenantId,
          sku: data.sku,
          name: data.name,
          description: data.description,
          shortDescription: data.shortDescription,
          type: data.type || 'simple',
          status: data.status || 'active',
          categoryId: data.categoryId,
          brandId: data.brandId,
          tags: data.tags || [],
          basePrice: data.basePrice.toString(),
          costPrice: data.costPrice?.toString(),
          msrp: data.msrp?.toString(),
          trackInventory: data.trackInventory ?? true,
          unitOfMeasure: data.unitOfMeasure || 'piece',
          weight: data.weight?.toString(),
          dimensions: data.dimensions || {},
          taxable: data.taxable ?? true,
          taxCategoryId: data.taxCategoryId,
          slug: data.slug,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          images: data.images || [],
          primaryImageUrl: data.primaryImageUrl,
          attributes: data.attributes || {},
          customFields: data.customFields || {},
          supplierId: data.supplierId,
          supplierSku: data.supplierSku,
          minStockLevel: data.minStockLevel || 0,
          maxStockLevel: data.maxStockLevel,
          reorderPoint: data.reorderPoint || 0,
          reorderQuantity: data.reorderQuantity || 0,
          requiresBatchTracking: data.requiresBatchTracking || false,
          requiresExpiryDate: data.requiresExpiryDate || false,
          shelfLife: data.shelfLife,
          isFeatured: data.isFeatured || false,
          allowBackorders: data.allowBackorders || false,
          launchedAt: data.launchedAt,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!product) {
        throw new Error('Failed to create product');
      }

      // Create variants if this is a variable product
      let variants: any[] = [];
      if (data.type === 'variable' && data.variants && data.variants.length > 0) {
        const variantInserts = data.variants.map(variant => ({
          tenantId,
          productId: product.id,
          sku: variant.sku,
          name: variant.name,
          attributes: variant.attributes.reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {} as Record<string, string>),
          price: variant.price?.toString(),
          costPrice: variant.costPrice?.toString(),
          weight: variant.weight?.toString(),
          dimensions: variant.dimensions || {},
          images: variant.images || [],
          primaryImageUrl: variant.images?.find(img => img.isPrimary)?.url,
          status: (variant.status || 'active') as 'active' | 'inactive' | 'discontinued' | 'out_of_stock',
          minStockLevel: variant.minStockLevel,
          maxStockLevel: variant.maxStockLevel,
          reorderPoint: variant.reorderPoint,
          reorderQuantity: variant.reorderQuantity,
          createdBy: userId,
          updatedBy: userId,
        }));

        variants = await tx
          .insert(productVariants)
          .values(variantInserts)
          .returning();
      }

      return {
        ...product,
        tags: Array.isArray(product.tags) ? product.tags as string[] : [],
        images: Array.isArray(product.images) ? product.images : [],
        variants,
      };
    });
  }

  async findById(tenantId: string, id: string): Promise<ProductWithVariants | null> {
    const db = this.drizzle.getDb();
    
    const [product] = await db
      .select()
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.id, id),
        eq(products.isActive, true)
      ));

    if (!product) {
      return null;
    }

    // Get variants if it's a variable product
    let variants: any[] = [];
    if (product.type === 'variable') {
      variants = await db
        .select()
        .from(productVariants)
        .where(and(
          eq(productVariants.tenantId, tenantId),
          eq(productVariants.productId, id),
          eq(productVariants.isActive, true)
        ))
        .orderBy(asc(productVariants.sortOrder));
    }

    // Get category and brand info
    let category = null;
    let brand = null;

    if (product.categoryId) {
      [category] = await db
        .select()
        .from(productCategories)
        .where(and(
          eq(productCategories.tenantId, tenantId),
          eq(productCategories.id, product.categoryId),
          eq(productCategories.isActive, true)
        ));
    }

    if (product.brandId) {
      [brand] = await db
        .select()
        .from(productBrands)
        .where(and(
          eq(productBrands.tenantId, tenantId),
          eq(productBrands.id, product.brandId),
          eq(productBrands.isActive, true)
        ));
    }

    return {
      ...product,
      tags: Array.isArray(product.tags) ? product.tags as string[] : [],
      images: Array.isArray(product.images) ? product.images : [],
      variants,
      category,
      brand,
    };
  }

  async findBySku(tenantId: string, sku: string): Promise<ProductWithVariants | null> {
    const db = this.drizzle.getDb();
    
    const [product] = await db
      .select()
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.sku, sku),
        eq(products.isActive, true)
      ));

    if (!product) {
      return null;
    }

    return this.findById(tenantId, product.id);
  }

  async findMany(tenantId: string, query: ProductQueryDto): Promise<{
    products: ProductWithVariants[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const db = this.drizzle.getDb();
    
    // Build where conditions
    const conditions = [
      eq(products.tenantId, tenantId),
      eq(products.isActive, true),
    ];

    if (query.search) {
      const searchCondition = or(
        ilike(products.name, `%${query.search}%`),
        ilike(products.sku, `%${query.search}%`),
        products.description ? ilike(products.description, `%${query.search}%`) : undefined
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (query.categoryId) {
      conditions.push(eq(products.categoryId, query.categoryId));
    }

    if (query.brandId) {
      conditions.push(eq(products.brandId, query.brandId));
    }

    if (query.status) {
      conditions.push(eq(products.status, query.status));
    }

    if (query.type) {
      conditions.push(eq(products.type, query.type));
    }

    if (query.supplierId) {
      conditions.push(eq(products.supplierId, query.supplierId));
    }

    if (query.isFeatured !== undefined) {
      conditions.push(eq(products.isFeatured, query.isFeatured));
    }

    if (query.trackInventory !== undefined) {
      conditions.push(eq(products.trackInventory, query.trackInventory));
    }

    if (query.minPrice !== undefined) {
      conditions.push(sql`${products.basePrice}::numeric >= ${query.minPrice}`);
    }

    if (query.maxPrice !== undefined) {
      conditions.push(sql`${products.basePrice}::numeric <= ${query.maxPrice}`);
    }

    if (query.tags) {
      const tagArray = query.tags.split(',').map(tag => tag.trim());
      conditions.push(sql`${products.tags} && ${tagArray}`);
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(products)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

    // Build order by clause
    let orderBy;
    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder || 'desc';

    switch (sortField) {
      case 'name':
        orderBy = sortDirection === 'asc' ? asc(products.name) : desc(products.name);
        break;
      case 'sku':
        orderBy = sortDirection === 'asc' ? asc(products.sku) : desc(products.sku);
        break;
      case 'basePrice':
        orderBy = sortDirection === 'asc' ? 
          sql`${products.basePrice}::numeric ASC` : 
          sql`${products.basePrice}::numeric DESC`;
        break;
      case 'createdAt':
      default:
        orderBy = sortDirection === 'asc' ? asc(products.createdAt) : desc(products.createdAt);
        break;
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Get products
    const productList = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get variants for variable products
    const variableProductIds = productList
      .filter(p => p.type === 'variable')
      .map(p => p.id);

    let variantsByProduct: Record<string, any[]> = {};
    if (variableProductIds.length > 0) {
      const variants = await db
        .select()
        .from(productVariants)
        .where(and(
          eq(productVariants.tenantId, tenantId),
          inArray(productVariants.productId, variableProductIds),
          eq(productVariants.isActive, true)
        ))
        .orderBy(asc(productVariants.sortOrder));

      variantsByProduct = variants.reduce((acc, variant) => {
        const productId = variant.productId;
        if (productId) {
          if (!acc[productId]) {
            acc[productId] = [];
          }
          acc[productId]!.push(variant);
        }
        return acc;
      }, {} as Record<string, any[]>);
    }

    // Combine products with their variants
    const productsWithVariants = productList.map(product => ({
      ...product,
      tags: Array.isArray(product.tags) ? product.tags as string[] : [],
      images: Array.isArray(product.images) ? product.images : [],
      variants: variantsByProduct[product.id] || [],
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      products: productsWithVariants,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async update(tenantId: string, id: string, data: UpdateProductDto, userId: string): Promise<ProductWithVariants | null> {
    const db = this.drizzle.getDb();
    
    return await db.transaction(async (tx) => {
      // Update the main product
      const updateData: any = {
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
        version: sql`${products.version} + 1`,
      };

      // Convert numeric fields to strings for decimal columns
      if (data.basePrice !== undefined) updateData.basePrice = data.basePrice.toString();
      if (data.costPrice !== undefined) updateData.costPrice = data.costPrice.toString();
      if (data.msrp !== undefined) updateData.msrp = data.msrp.toString();
      if (data.weight !== undefined) updateData.weight = data.weight.toString();

      const [updatedProduct] = await tx
        .update(products)
        .set(updateData)
        .where(and(
          eq(products.tenantId, tenantId),
          eq(products.id, id),
          eq(products.isActive, true)
        ))
        .returning();

      if (!updatedProduct) {
        return null;
      }

      // Handle variants update if provided
      if (data.variants) {
        // Delete existing variants
        await tx
          .delete(productVariants)
          .where(and(
            eq(productVariants.tenantId, tenantId),
            eq(productVariants.productId, id)
          ));

        // Insert new variants
        if (data.variants.length > 0) {
          const variantInserts = data.variants.map(variant => ({
            tenantId,
            productId: id,
            sku: variant.sku,
            name: variant.name,
            attributes: variant.attributes?.reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {} as Record<string, string>) || {},
            price: variant.price?.toString(),
            costPrice: variant.costPrice?.toString(),
            weight: variant.weight?.toString(),
            dimensions: variant.dimensions || {},
            images: variant.images || [],
            primaryImageUrl: variant.images?.find(img => img.isPrimary)?.url,
            status: (variant.status || 'active') as 'active' | 'inactive' | 'discontinued' | 'out_of_stock',
            minStockLevel: variant.minStockLevel,
            maxStockLevel: variant.maxStockLevel,
            reorderPoint: variant.reorderPoint,
            reorderQuantity: variant.reorderQuantity,
            createdBy: userId,
            updatedBy: userId,
          }));

          await tx
            .insert(productVariants)
            .values(variantInserts);
        }
      }

      return this.findById(tenantId, id);
    });
  }

  async delete(tenantId: string, id: string, userId: string): Promise<boolean> {
    const db = this.drizzle.getDb();
    
    const [result] = await db
      .update(products)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedBy: userId,
        version: sql`${products.version} + 1`,
      })
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.id, id),
        eq(products.isActive, true)
      ))
      .returning({ id: products.id });

    return !!result;
  }

  async bulkUpdate(tenantId: string, productIds: string[], data: UpdateProductDto, userId: string): Promise<number> {
    const db = this.drizzle.getDb();
    
    const updateData: any = {
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
      version: sql`${products.version} + 1`,
    };

    // Convert numeric fields to strings for decimal columns
    if (data.basePrice !== undefined) updateData.basePrice = data.basePrice.toString();
    if (data.costPrice !== undefined) updateData.costPrice = data.costPrice.toString();
    if (data.msrp !== undefined) updateData.msrp = data.msrp.toString();
    if (data.weight !== undefined) updateData.weight = data.weight.toString();

    const result = await db
      .update(products)
      .set(updateData)
      .where(and(
        eq(products.tenantId, tenantId),
        inArray(products.id, productIds),
        eq(products.isActive, true)
      ));

    return result.rowCount || 0;
  }

  async findLowStockProducts(tenantId: string, locationId?: string): Promise<ProductWithVariants[]> {
    const db = this.drizzle.getDb();
    
    // This would typically join with inventory levels table
    // For now, we'll return products that have reorder points set
    const lowStockProducts = await db
      .select()
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.isActive, true),
        eq(products.trackInventory, true),
        sql`${products.reorderPoint} > 0`
      ))
      .orderBy(desc(products.reorderPoint));

    return lowStockProducts.map(product => ({
      ...product,
      tags: Array.isArray(product.tags) ? product.tags as string[] : [],
      images: Array.isArray(product.images) ? product.images : [],
      variants: [], // Would be populated with actual inventory data
    }));
  }

  async searchProducts(tenantId: string, searchTerm: string, limit: number = 10): Promise<ProductWithVariants[]> {
    const db = this.drizzle.getDb();
    
    const searchResults = await db
      .select()
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.isActive, true),
        or(
          ilike(products.name, `%${searchTerm}%`),
          ilike(products.sku, `%${searchTerm}%`),
          ilike(products.description, `%${searchTerm}%`)
        )
      ))
      .limit(limit)
      .orderBy(desc(products.createdAt));

    return searchResults.map(product => ({
      ...product,
      tags: Array.isArray(product.tags) ? product.tags as string[] : [],
      images: Array.isArray(product.images) ? product.images : [],
      variants: [], // Would be populated if needed
    }));
  }
}