import { Injectable } from '@nestjs/common';
import { eq, and, like, ilike, desc, asc, sql, inArray, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import {
  suppliers,
  supplierContacts,
  supplierCommunications,
  supplierEvaluations,
  supplierPerformanceMetrics,
} from '../../database/schema/supplier.schema';
import { CreateSupplierDto, UpdateSupplierDto, SupplierQueryDto } from '../dto/supplier.dto';

export interface SupplierWithRelations {
  supplier: typeof suppliers.$inferSelect;
  contacts?: (typeof supplierContacts.$inferSelect)[];
  communications?: (typeof supplierCommunications.$inferSelect)[];
  evaluations?: (typeof supplierEvaluations.$inferSelect)[];
  performanceMetrics?: (typeof supplierPerformanceMetrics.$inferSelect)[];
}

@Injectable()
export class SupplierRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(
    tenantId: string,
    data: CreateSupplierDto,
    userId: string,
  ): Promise<typeof suppliers.$inferSelect> {
    const [supplier] = await this.drizzle.db
      .insert(suppliers)
      .values({
        tenantId,
        ...data,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return supplier;
  }

  async findById(
    tenantId: string,
    id: string,
    includeRelations = false,
  ): Promise<SupplierWithRelations | null> {
    const supplier = await this.drizzle.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, id), isNull(suppliers.deletedAt)))
      .limit(1);

    if (!supplier.length) {
      return null;
    }

    const result: SupplierWithRelations = {
      supplier: supplier[0],
    };

    if (includeRelations) {
      // Load contacts
      result.contacts = await this.drizzle.db
        .select()
        .from(supplierContacts)
        .where(
          and(
            eq(supplierContacts.tenantId, tenantId),
            eq(supplierContacts.supplierId, id),
            isNull(supplierContacts.deletedAt),
          ),
        )
        .orderBy(desc(supplierContacts.isPrimary), asc(supplierContacts.firstName));

      // Load recent communications
      result.communications = await this.drizzle.db
        .select()
        .from(supplierCommunications)
        .where(
          and(
            eq(supplierCommunications.tenantId, tenantId),
            eq(supplierCommunications.supplierId, id),
            isNull(supplierCommunications.deletedAt),
          ),
        )
        .orderBy(desc(supplierCommunications.communicationDate))
        .limit(10);

      // Load recent evaluations
      result.evaluations = await this.drizzle.db
        .select()
        .from(supplierEvaluations)
        .where(
          and(
            eq(supplierEvaluations.tenantId, tenantId),
            eq(supplierEvaluations.supplierId, id),
            isNull(supplierEvaluations.deletedAt),
          ),
        )
        .orderBy(desc(supplierEvaluations.evaluationDate))
        .limit(5);

      // Load performance metrics
      result.performanceMetrics = await this.drizzle.db
        .select()
        .from(supplierPerformanceMetrics)
        .where(
          and(
            eq(supplierPerformanceMetrics.tenantId, tenantId),
            eq(supplierPerformanceMetrics.supplierId, id),
            isNull(supplierPerformanceMetrics.deletedAt),
          ),
        )
        .orderBy(desc(supplierPerformanceMetrics.periodEnd))
        .limit(12); // Last 12 periods
    }

    return result;
  }

  async findByCode(
    tenantId: string,
    supplierCode: string,
  ): Promise<typeof suppliers.$inferSelect | null> {
    const [supplier] = await this.drizzle.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          eq(suppliers.supplierCode, supplierCode),
          isNull(suppliers.deletedAt),
        ),
      )
      .limit(1);

    return supplier || null;
  }

  async findMany(
    tenantId: string,
    query: SupplierQueryDto,
  ): Promise<{
    suppliers: (typeof suppliers.$inferSelect)[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { search, status, supplierType, rating, preferredOnly, tags, page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = query;

    // Build where conditions
    const conditions = [eq(suppliers.tenantId, tenantId), isNull(suppliers.deletedAt)];

    if (search) {
      conditions.push(
        sql`(${ilike(suppliers.name, `%${search}%`)} OR ${ilike(suppliers.supplierCode, `%${search}%`)} OR ${ilike(suppliers.primaryContactName, `%${search}%`)})`,
      );
    }

    if (status) {
      conditions.push(eq(suppliers.status, status));
    }

    if (supplierType) {
      conditions.push(eq(suppliers.supplierType, supplierType));
    }

    if (rating) {
      conditions.push(eq(suppliers.overallRating, rating));
    }

    if (preferredOnly) {
      conditions.push(eq(suppliers.isPreferredSupplier, true));
    }

    if (tags && tags.length > 0) {
      conditions.push(sql`${suppliers.tags} @> ${JSON.stringify(tags)}`);
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count }] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(whereClause);

    // Build order by clause
    const orderByColumn = suppliers[sortBy as keyof typeof suppliers] || suppliers.name;
    const orderByClause = sortOrder === 'desc' ? desc(orderByColumn) : asc(orderByColumn);

    // Get paginated results
    const offset = (page - 1) * limit;
    const supplierList = await this.drizzle.db
      .select()
      .from(suppliers)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(count / limit);

    return {
      suppliers: supplierList,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  async update(
    tenantId: string,
    id: string,
    data: UpdateSupplierDto,
    userId: string,
  ): Promise<typeof suppliers.$inferSelect | null> {
    const [supplier] = await this.drizzle.db
      .update(suppliers)
      .set({
        ...data,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, id), isNull(suppliers.deletedAt)))
      .returning();

    return supplier || null;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<boolean> {
    const [supplier] = await this.drizzle.db
      .update(suppliers)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, id), isNull(suppliers.deletedAt)))
      .returning();

    return !!supplier;
  }

  async updateRatings(
    tenantId: string,
    supplierId: string,
    ratings: {
      overallRating?: string;
      qualityRating?: number;
      deliveryRating?: number;
      serviceRating?: number;
    },
    userId: string,
  ): Promise<typeof suppliers.$inferSelect | null> {
    const [supplier] = await this.drizzle.db
      .update(suppliers)
      .set({
        ...ratings,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, supplierId), isNull(suppliers.deletedAt)))
      .returning();

    return supplier || null;
  }

  async findPreferredSuppliers(tenantId: string): Promise<(typeof suppliers.$inferSelect)[]> {
    return await this.drizzle.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          eq(suppliers.isPreferredSupplier, true),
          eq(suppliers.status, 'active'),
          isNull(suppliers.deletedAt),
        ),
      )
      .orderBy(asc(suppliers.name));
  }

  async findByStatus(
    tenantId: string,
    status: string,
  ): Promise<(typeof suppliers.$inferSelect)[]> {
    return await this.drizzle.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          eq(suppliers.status, status),
          isNull(suppliers.deletedAt),
        ),
      )
      .orderBy(asc(suppliers.name));
  }

  async getSupplierStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    pendingApproval: number;
    preferred: number;
    averageRating: number;
  }> {
    const stats = await this.drizzle.db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where status = 'active')`,
        inactive: sql<number>`count(*) filter (where status = 'inactive')`,
        pendingApproval: sql<number>`count(*) filter (where status = 'pending_approval')`,
        preferred: sql<number>`count(*) filter (where is_preferred_supplier = true)`,
        averageQualityRating: sql<number>`avg(quality_rating)`,
        averageDeliveryRating: sql<number>`avg(delivery_rating)`,
        averageServiceRating: sql<number>`avg(service_rating)`,
      })
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), isNull(suppliers.deletedAt)));

    const result = stats[0];
    const averageRating = (
      (result.averageQualityRating || 0) +
      (result.averageDeliveryRating || 0) +
      (result.averageServiceRating || 0)
    ) / 3;

    return {
      total: result.total,
      active: result.active,
      inactive: result.inactive,
      pendingApproval: result.pendingApproval,
      preferred: result.preferred,
      averageRating: Math.round(averageRating * 100) / 100,
    };
  }

  async searchSuppliers(
    tenantId: string,
    searchTerm: string,
    limit = 10,
  ): Promise<(typeof suppliers.$inferSelect)[]> {
    return await this.drizzle.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          sql`(${ilike(suppliers.name, `%${searchTerm}%`)} OR ${ilike(suppliers.supplierCode, `%${searchTerm}%`)})`,
          eq(suppliers.status, 'active'),
          isNull(suppliers.deletedAt),
        ),
      )
      .orderBy(asc(suppliers.name))
      .limit(limit);
  }
}