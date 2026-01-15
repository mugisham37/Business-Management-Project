import { Injectable, Inject } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { 
  productCategories,
  products
} from '../../database/schema';
import { eq, and, ilike, isNull, or, desc, asc, sql, count } from 'drizzle-orm';
import { CreateCategoryDto, UpdateCategoryDto, CategoryQueryDto } from '../dto/category.dto';

export interface CategoryWithChildren {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  slug?: string | null;
  parentId?: string | null;
  level: number;
  path?: string | null;
  sortOrder: number | null;
  isVisible: boolean;
  imageUrl?: string | null;
  iconUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  attributes?: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  version: number;
  children?: CategoryWithChildren[];
  productCount?: number;
}

@Injectable()
export class ProductCategoryRepository {
  constructor(
    @Inject('DRIZZLE_SERVICE') private readonly drizzle: DrizzleService,
  ) {}

  async create(tenantId: string, data: CreateCategoryDto, userId: string): Promise<CategoryWithChildren> {
    const db = this.drizzle.getDb();
    
    return await db.transaction(async (tx) => {
      // Calculate level and path if parent is provided
      let level = 0;
      let path = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      if (data.parentId) {
        const parent = await tx
          .select()
          .from(productCategories)
          .where(and(
            eq(productCategories.tenantId, tenantId),
            eq(productCategories.id, data.parentId),
            eq(productCategories.isActive, true)
          ))
          .limit(1);

        if (parent.length > 0 && parent[0]) {
          level = parent[0].level + 1;
          path = `${parent[0].path}/${path}`;
        }
      }

      const [category] = await tx
        .insert(productCategories)
        .values({
          tenantId,
          name: data.name,
          description: data.description,
          slug: data.slug,
          parentId: data.parentId,
          level,
          path,
          sortOrder: data.sortOrder || 0,
          isVisible: data.isVisible ?? true,
          imageUrl: data.imageUrl,
          iconUrl: data.iconUrl,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          attributes: data.attributes || {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!category) {
        throw new Error('Failed to create category');
      }

      return category;
    });
  }

  async findById(tenantId: string, id: string): Promise<CategoryWithChildren | null> {
    const db = this.drizzle.getDb();
    
    const [category] = await db
      .select()
      .from(productCategories)
      .where(and(
        eq(productCategories.tenantId, tenantId),
        eq(productCategories.id, id),
        eq(productCategories.isActive, true)
      ));

    if (!category) {
      return null;
    }

    // Get product count for this category
    const [countResult] = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.categoryId, id),
        eq(products.isActive, true)
      ));

    const productCount = countResult?.count || 0;

    return {
      ...category,
      sortOrder: category.sortOrder ?? 0,
      productCount,
    };
  }

  async findBySlug(tenantId: string, slug: string): Promise<CategoryWithChildren | null> {
    const db = this.drizzle.getDb();
    
    const [category] = await db
      .select()
      .from(productCategories)
      .where(and(
        eq(productCategories.tenantId, tenantId),
        eq(productCategories.slug, slug),
        eq(productCategories.isActive, true)
      ));

    if (!category) {
      return null;
    }

    return this.findById(tenantId, category.id);
  }

  async findMany(tenantId: string, query: CategoryQueryDto): Promise<{
    categories: CategoryWithChildren[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const db = this.drizzle.getDb();
    
    // Build where conditions
    const conditions = [
      eq(productCategories.tenantId, tenantId),
      eq(productCategories.isActive, true),
    ];

    if (query.search) {
      const searchCondition = or(
        ilike(productCategories.name, `%${query.search}%`),
        productCategories.description ? ilike(productCategories.description, `%${query.search}%`) : undefined
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (query.parentId) {
      conditions.push(eq(productCategories.parentId, query.parentId));
    } else if (query.parentId === null) {
      conditions.push(isNull(productCategories.parentId));
    }

    if (query.isVisible !== undefined) {
      conditions.push(eq(productCategories.isVisible, query.isVisible));
    }

    if (query.level !== undefined) {
      conditions.push(eq(productCategories.level, query.level));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(productCategories)
      .where(whereClause);

    const totalCount = countResult?.count || 0;

    // Build order by clause
    let orderBy;
    const sortField = query.sortBy || 'sortOrder';
    const sortDirection = query.sortOrder || 'asc';

    switch (sortField) {
      case 'name':
        orderBy = sortDirection === 'asc' ? asc(productCategories.name) : desc(productCategories.name);
        break;
      case 'level':
        orderBy = sortDirection === 'asc' ? asc(productCategories.level) : desc(productCategories.level);
        break;
      case 'createdAt':
        orderBy = sortDirection === 'asc' ? asc(productCategories.createdAt) : desc(productCategories.createdAt);
        break;
      case 'sortOrder':
      default:
        orderBy = sortDirection === 'asc' ? asc(productCategories.sortOrder) : desc(productCategories.sortOrder);
        break;
    }

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Get categories
    const categoryList = await db
      .select()
      .from(productCategories)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get product counts for each category
    const categoryIds = categoryList.map(c => c.id);
    const productCounts: Record<string, number> = {};

    if (categoryIds.length > 0) {
      const counts = await db
        .select({
          categoryId: products.categoryId,
          count: count(),
        })
        .from(products)
        .where(and(
          eq(products.tenantId, tenantId),
          eq(products.isActive, true),
          sql`${products.categoryId} = ANY(${categoryIds})`
        ))
        .groupBy(products.categoryId);

      counts.forEach(({ categoryId, count }) => {
        if (categoryId) {
          productCounts[categoryId] = count;
        }
      });
    }

    const categoriesWithCounts = categoryList.map(category => ({
      ...category,
      sortOrder: category.sortOrder ?? 0,
      productCount: productCounts[category.id] || 0,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      categories: categoriesWithCounts,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async findTree(tenantId: string): Promise<CategoryWithChildren[]> {
    const db = this.drizzle.getDb();
    
    // Get all categories ordered by level and sort order
    const allCategories = await db
      .select()
      .from(productCategories)
      .where(and(
        eq(productCategories.tenantId, tenantId),
        eq(productCategories.isActive, true)
      ))
      .orderBy(asc(productCategories.level), asc(productCategories.sortOrder));

    // Build tree structure
    const categoryMap = new Map<string, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];

    // First pass: create map of all categories
    allCategories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        sortOrder: category.sortOrder ?? 0,
        children: [],
        productCount: 0,
      });
    });

    // Second pass: build tree structure
    allCategories.forEach(category => {
      const categoryNode = categoryMap.get(category.id)!;
      
      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children!.push(categoryNode);
        }
      } else {
        rootCategories.push(categoryNode);
      }
    });

    return rootCategories;
  }

  async findChildren(tenantId: string, parentId: string): Promise<CategoryWithChildren[]> {
    const db = this.drizzle.getDb();
    
    const children = await db
      .select()
      .from(productCategories)
      .where(and(
        eq(productCategories.tenantId, tenantId),
        eq(productCategories.parentId, parentId),
        eq(productCategories.isActive, true)
      ))
      .orderBy(asc(productCategories.sortOrder));

    // Get product counts for each child category
    const categoryIds = children.map(c => c.id);
    const productCounts: Record<string, number> = {};

    if (categoryIds.length > 0) {
      const counts = await db
        .select({
          categoryId: products.categoryId,
          count: count(),
        })
        .from(products)
        .where(and(
          eq(products.tenantId, tenantId),
          eq(products.isActive, true),
          sql`${products.categoryId} = ANY(${categoryIds})`
        ))
        .groupBy(products.categoryId);

      counts.forEach(({ categoryId, count }) => {
        if (categoryId) {
          productCounts[categoryId] = count;
        }
      });
    }

    return children.map(category => ({
      ...category,
      sortOrder: category.sortOrder ?? 0,
      productCount: productCounts[category.id] || 0,
    }));
  }

  async update(tenantId: string, id: string, data: UpdateCategoryDto, userId: string): Promise<CategoryWithChildren | null> {
    const db = this.drizzle.getDb();
    
    return await db.transaction(async (tx) => {
      // Update path if parent changed
      let updateData: any = {
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
        version: sql`${productCategories.version} + 1`,
      };

      if (data.parentId !== undefined) {
        let level = 0;
        let path = data.slug || data.name;

        if (data.parentId) {
          const parent = await tx
            .select()
            .from(productCategories)
            .where(and(
              eq(productCategories.tenantId, tenantId),
              eq(productCategories.id, data.parentId),
              eq(productCategories.isActive, true)
            ))
            .limit(1);

          if (parent.length > 0 && parent[0]) {
            level = parent[0].level + 1;
            path = `${parent[0].path}/${path}`;
          }
        }

        updateData.level = level;
        updateData.path = path;
      }

      const [updatedCategory] = await tx
        .update(productCategories)
        .set(updateData)
        .where(and(
          eq(productCategories.tenantId, tenantId),
          eq(productCategories.id, id),
          eq(productCategories.isActive, true)
        ))
        .returning();

      if (!updatedCategory) {
        return null;
      }

      return this.findById(tenantId, id);
    });
  }

  async delete(tenantId: string, id: string, userId: string): Promise<boolean> {
    const db = this.drizzle.getDb();
    
    const [result] = await db
      .update(productCategories)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedBy: userId,
        version: sql`${productCategories.version} + 1`,
      })
      .where(and(
        eq(productCategories.tenantId, tenantId),
        eq(productCategories.id, id),
        eq(productCategories.isActive, true)
      ))
      .returning({ id: productCategories.id });

    return !!result;
  }

  async hasProducts(tenantId: string, categoryId: string): Promise<boolean> {
    const db = this.drizzle.getDb();
    
    const [countResult] = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.categoryId, categoryId),
        eq(products.isActive, true)
      ));

    const productCount = countResult?.count || 0;

    return productCount > 0;
  }
}