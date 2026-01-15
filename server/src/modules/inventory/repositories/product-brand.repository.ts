import { Injectable, Inject } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  productBrands,
  products
} from '../../database/schema';
import { eq, and, ilike, or, desc, asc, sql, count } from 'drizzle-orm';
import { CreateBrandDto, UpdateBrandDto, BrandQueryDto } from '../dto/brand.dto';

export interface BrandWithProductCount {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  slug?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  attributes?: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  version: number;
  productCount?: number;
}

@Injectable()
export class ProductBrandRepository {
  constructor(
    @Inject('DRIZZLE_SERVICE') private readonly drizzle: DrizzleService,
  ) {}

  async create(tenantId: string, data: CreateBrandDto, userId: string): Promise<BrandWithProductCount> {
    const db = this.drizzle.getDb();
    
    const [brand] = await db
      .insert(productBrands)
      .values({
        tenantId,
        name: data.name,
        description: data.description,
        slug: data.slug,
        website: data.website,
        logoUrl: data.logoUrl,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        attributes: data.attributes || {},
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    if (!brand) {
      throw new Error('Failed to create brand');
    }

    return {
      ...brand,
      productCount: 0,
    };
  }

  async findById(tenantId: string, id: string): Promise<BrandWithProductCount | null> {
    const db = this.drizzle.getDb();
    
    const [brand] = await db
      .select()
      .from(productBrands)
      .where(and(
        eq(productBrands.tenantId, tenantId),
        eq(productBrands.id, id),
        eq(productBrands.isActive, true)
      ));

    if (!brand) {
      return null;
    }

    // Get product count for this brand
    const [countResult] = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.brandId, id),
        eq(products.isActive, true)
      ));

    const productCount = countResult?.count || 0;

    return {
      ...brand,
      productCount,
    };
  }

  async findBySlug(tenantId: string, slug: string): Promise<BrandWithProductCount | null> {
    const db = this.drizzle.getDb();
    
    const [brand] = await db
      .select()
      .from(productBrands)
      .where(and(
        eq(productBrands.tenantId, tenantId),
        eq(productBrands.slug, slug),
        eq(productBrands.isActive, true)
      ));

    if (!brand) {
      return null;
    }

    return this.findById(tenantId, brand.id);
  }

  async findMany(tenantId: string, query: BrandQueryDto): Promise<{
    brands: BrandWithProductCount[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const db = this.drizzle.getDb();
    
    // Build where conditions
    const conditions = [
      eq(productBrands.tenantId, tenantId),
      eq(productBrands.isActive, true),
    ];

    if (query.search) {
      const searchCondition = or(
        ilike(productBrands.name, `%${query.search}%`),
        productBrands.description ? ilike(productBrands.description, `%${query.search}%`) : undefined
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(productBrands)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

    // Build order by clause
    let orderBy;
    const sortField = query.sortBy || 'name';
    const sortDirection = query.sortOrder || 'asc';

    switch (sortField) {
      case 'name':
        orderBy = sortDirection === 'asc' ? asc(productBrands.name) : desc(productBrands.name);
        break;
      case 'createdAt':
        orderBy = sortDirection === 'asc' ? asc(productBrands.createdAt) : desc(productBrands.createdAt);
        break;
      default:
        orderBy = sortDirection === 'asc' ? asc(productBrands.name) : desc(productBrands.name);
        break;
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Get brands
    const brandList = await db
      .select()
      .from(productBrands)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get product counts for each brand
    const brandIds = brandList.map(b => b.id);
    const productCounts: Record<string, number> = {};

    if (brandIds.length > 0) {
      const counts = await db
        .select({
          brandId: products.brandId,
          count: count(),
        })
        .from(products)
        .where(and(
          eq(products.tenantId, tenantId),
          eq(products.isActive, true),
          sql`${products.brandId} = ANY(${brandIds})`
        ))
        .groupBy(products.brandId);

      counts.forEach(({ brandId, count }) => {
        if (brandId) {
          productCounts[brandId] = count;
        }
      });
    }

    const brandsWithCounts = brandList.map(brand => ({
      ...brand,
      productCount: productCounts[brand.id] || 0,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      brands: brandsWithCounts,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async update(tenantId: string, id: string, data: UpdateBrandDto, userId: string): Promise<BrandWithProductCount | null> {
    const db = this.drizzle.getDb();
    
    const updateData: any = {
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
      version: sql`${productBrands.version} + 1`,
    };

    const [updatedBrand] = await db
      .update(productBrands)
      .set(updateData)
      .where(and(
        eq(productBrands.tenantId, tenantId),
        eq(productBrands.id, id),
        eq(productBrands.isActive, true)
      ))
      .returning();

    if (!updatedBrand) {
      return null;
    }

    return this.findById(tenantId, id);
  }

  async delete(tenantId: string, id: string, userId: string): Promise<boolean> {
    const db = this.drizzle.getDb();
    
    const [result] = await db
      .update(productBrands)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedBy: userId,
        version: sql`${productBrands.version} + 1`,
      })
      .where(and(
        eq(productBrands.tenantId, tenantId),
        eq(productBrands.id, id),
        eq(productBrands.isActive, true)
      ))
      .returning({ id: productBrands.id });

    return !!result;
  }

  async hasProducts(tenantId: string, brandId: string): Promise<boolean> {
    const db = this.drizzle.getDb();
    
    const [countResult] = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.brandId, brandId),
        eq(products.isActive, true)
      ));

    const productCount = countResult?.count || 0;

    return productCount > 0;
  }
}